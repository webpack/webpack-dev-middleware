const path = require("path");

const mime = require("mime-types");

const onFinishedStream = require("on-finished");

const getFilenameFromUrl = require("./utils/getFilenameFromUrl");
const { setStatusCode, send, pipe } = require("./utils/compatibleAPI");
const ready = require("./utils/ready");
const escapeHtml = require("./utils/escapeHtml");

/** @typedef {import("./index.js").NextFunction} NextFunction */
/** @typedef {import("./index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("./index.js").ServerResponse} ServerResponse */
/** @typedef {import("./index.js").NormalizedHeaders} NormalizedHeaders */
/** @typedef {import("fs").ReadStream} ReadStream */

const BYTES_RANGE_REGEXP = /^ *bytes/i;

/**
 * @param {string} type
 * @param {number} size
 * @param {import("range-parser").Range} [range]
 * @returns {string}
 */
function getValueContentRangeHeader(type, size, range) {
  return `${type} ${range ? `${range.start}-${range.end}` : "*"}/${size}`;
}

/**
 * @param {import("fs").ReadStream} stream stream
 * @param {boolean} suppress do need suppress?
 * @returns {void}
 */
function destroyStream(stream, suppress) {
  if (typeof stream.destroy === "function") {
    stream.destroy();
  }

  if (typeof stream.close === "function") {
    // Node.js core bug workaround
    stream.on(
      "open",
      /**
       * @this {import("fs").ReadStream}
       */
      function onOpenClose() {
        // @ts-ignore
        if (typeof this.fd === "number") {
          // actually close down the fd
          this.close();
        }
      },
    );
  }

  if (typeof stream.addListener === "function" && suppress) {
    stream.removeAllListeners("error");
    stream.addListener("error", () => {});
  }
}

/** @type {Record<number, string>} */
const statuses = {
  400: "Bad Request",
  403: "Forbidden",
  404: "Not Found",
  416: "Range Not Satisfiable",
  500: "Internal Server Error",
};

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @typedef {Object} SendErrorOptions send error options
 * @property {Record<string, number | string | string[] | undefined>=} headers headers
 * @property {import("./index").ModifyResponseData<Request, Response>=} modifyResponseData modify response data callback
 */

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("./index.js").FilledContext<Request, Response>} context
 * @return {import("./index.js").Middleware<Request, Response>}
 */
function wrapper(context) {
  return async function middleware(req, res, next) {
    const acceptedMethods = context.options.methods || ["GET", "HEAD"];

    // fixes #282. credit @cexoso. in certain edge situations res.locals is undefined.
    // eslint-disable-next-line no-param-reassign
    res.locals = res.locals || {};

    async function goNext() {
      if (!context.options.serverSideRender) {
        return next();
      }

      return new Promise((resolve) => {
        ready(
          context,
          () => {
            /** @type {any} */
            // eslint-disable-next-line no-param-reassign
            (res.locals).webpack = { devMiddleware: context };

            resolve(next());
          },
          req,
        );
      });
    }

    if (req.method && !acceptedMethods.includes(req.method)) {
      await goNext();

      return;
    }

    /**
     * @param {number} status status
     * @param {Partial<SendErrorOptions<Request, Response>>=} options options
     * @returns {void}
     */
    function sendError(status, options) {
      const content = statuses[status] || String(status);
      let document = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>${escapeHtml(content)}</pre>
</body>
</html>`;

      // Clear existing headers
      const headers = res.getHeaderNames();

      for (let i = 0; i < headers.length; i++) {
        res.removeHeader(headers[i]);
      }

      if (options && options.headers) {
        const keys = Object.keys(options.headers);

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const value = options.headers[key];

          if (typeof value !== "undefined") {
            res.setHeader(key, value);
          }
        }
      }

      // Send basic response
      setStatusCode(res, status);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Security-Policy", "default-src 'none'");
      res.setHeader("X-Content-Type-Options", "nosniff");

      let byteLength = Buffer.byteLength(document);

      if (options && options.modifyResponseData) {
        ({ data: document, byteLength } =
          /** @type {{data: string, byteLength: number }} */
          (options.modifyResponseData(req, res, document, byteLength)));
      }

      res.setHeader("Content-Length", byteLength);

      res.end(document);
    }

    async function processRequest() {
      // Pipe and SendFile
      /** @type {import("./utils/getFilenameFromUrl").Extra} */
      const extra = {};
      const filename = getFilenameFromUrl(
        context,
        /** @type {string} */ (req.url),
        extra,
      );

      if (extra.errorCode) {
        if (extra.errorCode === 403) {
          context.logger.error(`Malicious path "${filename}".`);
        }

        sendError(extra.errorCode, {
          modifyResponseData: context.options.modifyResponseData,
        });

        return;
      }

      if (!filename) {
        await goNext();

        return;
      }

      // Send logic
      let { headers } = context.options;

      if (typeof headers === "function") {
        headers = /** @type {NormalizedHeaders} */ (headers(req, res, context));
      }

      /**
       * @type {{key: string, value: string | number}[]}
       */
      const allHeaders = [];

      if (typeof headers !== "undefined") {
        if (!Array.isArray(headers)) {
          // eslint-disable-next-line guard-for-in
          for (const name in headers) {
            allHeaders.push({ key: name, value: headers[name] });
          }

          headers = allHeaders;
        }

        headers.forEach((header) => {
          res.setHeader(header.key, header.value);
        });
      }

      if (!res.getHeader("Content-Type")) {
        // content-type name(like application/javascript; charset=utf-8) or false
        const contentType = mime.contentType(path.extname(filename));

        // Only set content-type header if media type is known
        // https://tools.ietf.org/html/rfc7231#section-3.1.1.5
        if (contentType) {
          res.setHeader("Content-Type", contentType);
        } else if (context.options.mimeTypeDefault) {
          res.setHeader("Content-Type", context.options.mimeTypeDefault);
        }
      }

      if (!res.getHeader("Accept-Ranges")) {
        res.setHeader("Accept-Ranges", "bytes");
      }

      const rangeHeader = /** @type {string} */ (req.headers.range);

      let len = /** @type {import("fs").Stats} */ (extra.stats).size;
      let offset = 0;

      if (rangeHeader && BYTES_RANGE_REGEXP.test(rangeHeader)) {
        // eslint-disable-next-line global-require
        const parsedRanges = require("range-parser")(len, rangeHeader, {
          combine: true,
        });

        if (parsedRanges === -1) {
          context.logger.error("Unsatisfiable range for 'Range' header.");

          res.setHeader(
            "Content-Range",
            getValueContentRangeHeader("bytes", len),
          );

          sendError(416, {
            headers: {
              "Content-Range": res.getHeader("Content-Range"),
            },
            modifyResponseData: context.options.modifyResponseData,
          });

          return;
        } else if (parsedRanges === -2) {
          context.logger.error(
            "A malformed 'Range' header was provided. A regular response will be sent for this request.",
          );
        } else if (parsedRanges.length > 1) {
          context.logger.error(
            "A 'Range' header with multiple ranges was provided. Multiple ranges are not supported, so a regular response will be sent for this request.",
          );
        }

        if (parsedRanges !== -2 && parsedRanges.length === 1) {
          // Content-Range
          setStatusCode(res, 206);
          res.setHeader(
            "Content-Range",
            getValueContentRangeHeader(
              "bytes",
              len,
              /** @type {import("range-parser").Ranges} */ (parsedRanges)[0],
            ),
          );

          offset += parsedRanges[0].start;
          len = parsedRanges[0].end - parsedRanges[0].start + 1;
        }
      }

      const start = offset;
      const end = Math.max(offset, offset + len - 1);

      // Stream logic
      const isFsSupportsStream =
        typeof context.outputFileSystem.createReadStream === "function";

      /** @type {string | Buffer | ReadStream} */
      let bufferOrStream;
      let byteLength;

      try {
        if (isFsSupportsStream) {
          bufferOrStream =
            /** @type {import("fs").createReadStream} */
            (context.outputFileSystem.createReadStream)(filename, {
              start,
              end,
            });

          // Handle files with zero bytes
          byteLength = end === 0 ? 0 : end - start + 1;
        } else {
          bufferOrStream = /** @type {import("fs").readFileSync} */ (
            context.outputFileSystem.readFileSync
          )(filename);
          ({ byteLength } = bufferOrStream);
        }
      } catch (_ignoreError) {
        await goNext();

        return;
      }

      if (context.options.modifyResponseData) {
        ({ data: bufferOrStream, byteLength } =
          context.options.modifyResponseData(
            req,
            res,
            bufferOrStream,
            byteLength,
          ));
      }

      res.setHeader("Content-Length", byteLength);

      if (req.method === "HEAD") {
        // For Koa
        if (res.statusCode === 404) {
          setStatusCode(res, 200);
        }

        res.end();
        return;
      }

      const isPipeSupports =
        typeof (
          /** @type {import("fs").ReadStream} */ (bufferOrStream).pipe
        ) === "function";

      if (!isPipeSupports) {
        send(res, /** @type {Buffer} */ (bufferOrStream));
        return;
      }

      // Cleanup
      const cleanup = () => {
        destroyStream(
          /** @type {import("fs").ReadStream} */ (bufferOrStream),
          true,
        );
      };

      // Error handling
      /** @type {import("fs").ReadStream} */
      (bufferOrStream).on("error", (error) => {
        // clean up stream early
        cleanup();

        // Handle Error
        switch (/** @type {NodeJS.ErrnoException} */ (error).code) {
          case "ENAMETOOLONG":
          case "ENOENT":
          case "ENOTDIR":
            sendError(404, {
              modifyResponseData: context.options.modifyResponseData,
            });
            break;
          default:
            sendError(500, {
              modifyResponseData: context.options.modifyResponseData,
            });
            break;
        }
      });

      pipe(res, /** @type {ReadStream} */ (bufferOrStream));

      // Response finished, cleanup
      onFinishedStream(res, cleanup);
    }

    ready(context, processRequest, req);
  };
}

module.exports = wrapper;
