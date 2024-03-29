const path = require("path");

const mime = require("mime-types");

const onFinishedStream = require("on-finished");

const getFilenameFromUrl = require("./utils/getFilenameFromUrl");
const {
  setStatusCode,
  send,
  pipe,
  createReadStreamOrReadFileSync,
} = require("./utils/compatibleAPI");
const ready = require("./utils/ready");
const parseTokenList = require("./utils/parseTokenList");
const memorize = require("./utils/memorize");

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
 * Parse an HTTP Date into a number.
 *
 * @param {string} date
 * @returns {number}
 */
function parseHttpDate(date) {
  const timestamp = date && Date.parse(date);

  // istanbul ignore next: guard against date.js Date.parse patching
  return typeof timestamp === "number" ? timestamp : NaN;
}

const CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;

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

const parseRangeHeaders = memorize(
  /**
   * @param {string} value
   * @returns {import("range-parser").Result | import("range-parser").Ranges}
   */
  (value) => {
    const [len, rangeHeader] = value.split("|");

    // eslint-disable-next-line global-require
    return require("range-parser")(Number(len), rangeHeader, {
      combine: true,
    });
  },
);

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
      // eslint-disable-next-line global-require
      const escapeHtml = require("./utils/escapeHtml");
      const content = statuses[status] || String(status);
      let document = Buffer.from(
        `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>${escapeHtml(content)}</pre>
</body>
</html>`,
        "utf-8",
      );

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
          /** @type {{ data: Buffer, byteLength: number }} */
          (options.modifyResponseData(req, res, document, byteLength)));
      }

      res.setHeader("Content-Length", byteLength);

      res.end(document);
    }

    function isConditionalGET() {
      return (
        req.headers["if-match"] ||
        req.headers["if-unmodified-since"] ||
        req.headers["if-none-match"] ||
        req.headers["if-modified-since"]
      );
    }

    function isPreconditionFailure() {
      // if-match
      const ifMatch = req.headers["if-match"];

      // A recipient MUST ignore If-Unmodified-Since if the request contains
      // an If-Match header field; the condition in If-Match is considered to
      // be a more accurate replacement for the condition in
      // If-Unmodified-Since, and the two are only combined for the sake of
      // interoperating with older intermediaries that might not implement If-Match.
      if (ifMatch) {
        const etag = res.getHeader("ETag");

        return (
          !etag ||
          (ifMatch !== "*" &&
            parseTokenList(ifMatch).every(
              (match) =>
                match !== etag &&
                match !== `W/${etag}` &&
                `W/${match}` !== etag,
            ))
        );
      }

      // if-unmodified-since
      const ifUnmodifiedSince = req.headers["if-unmodified-since"];

      if (ifUnmodifiedSince) {
        const unmodifiedSince = parseHttpDate(ifUnmodifiedSince);

        // A recipient MUST ignore the If-Unmodified-Since header field if the
        // received field-value is not a valid HTTP-date.
        if (!isNaN(unmodifiedSince)) {
          const lastModified = parseHttpDate(
            /** @type {string} */ (res.getHeader("Last-Modified")),
          );

          return isNaN(lastModified) || lastModified > unmodifiedSince;
        }
      }

      return false;
    }

    /**
     * @returns {boolean} is cachable
     */
    function isCachable() {
      return (
        (res.statusCode >= 200 && res.statusCode < 300) ||
        res.statusCode === 304
      );
    }

    /**
     * @param {import("http").OutgoingHttpHeaders} resHeaders
     * @returns {boolean}
     */
    function isFresh(resHeaders) {
      // Always return stale when Cache-Control: no-cache to support end-to-end reload requests
      // https://tools.ietf.org/html/rfc2616#section-14.9.4
      const cacheControl = req.headers["cache-control"];

      if (cacheControl && CACHE_CONTROL_NO_CACHE_REGEXP.test(cacheControl)) {
        return false;
      }

      // fields
      const noneMatch = req.headers["if-none-match"];
      const modifiedSince = req.headers["if-modified-since"];

      // unconditional request
      if (!noneMatch && !modifiedSince) {
        return false;
      }

      // if-none-match
      if (noneMatch && noneMatch !== "*") {
        if (!resHeaders.etag) {
          return false;
        }

        const matches = parseTokenList(noneMatch);

        let etagStale = true;

        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];

          if (
            match === resHeaders.etag ||
            match === `W/${resHeaders.etag}` ||
            `W/${match}` === resHeaders.etag
          ) {
            etagStale = false;
            break;
          }
        }

        if (etagStale) {
          return false;
        }
      }

      // A recipient MUST ignore If-Modified-Since if the request contains an If-None-Match header field;
      // the condition in If-None-Match is considered to be a more accurate replacement for the condition in If-Modified-Since,
      // and the two are only combined for the sake of interoperating with older intermediaries that might not implement If-None-Match.
      if (noneMatch) {
        return true;
      }

      // if-modified-since
      if (modifiedSince) {
        const lastModified = resHeaders["last-modified"];

        //  A recipient MUST ignore the If-Modified-Since header field if the
        //  received field-value is not a valid HTTP-date, or if the request
        //  method is neither GET nor HEAD.
        const modifiedStale =
          !lastModified ||
          !(parseHttpDate(lastModified) <= parseHttpDate(modifiedSince));

        if (modifiedStale) {
          return false;
        }
      }

      return true;
    }

    function isRangeFresh() {
      const ifRange =
        /** @type {string | undefined} */
        (req.headers["if-range"]);

      if (!ifRange) {
        return true;
      }

      // if-range as etag
      if (ifRange.indexOf('"') !== -1) {
        const etag = /** @type {string | undefined} */ (res.getHeader("ETag"));

        if (!etag) {
          return true;
        }

        return Boolean(etag && ifRange.indexOf(etag) !== -1);
      }

      // if-range as modified date
      const lastModified =
        /** @type {string | undefined} */
        (res.getHeader("Last-Modified"));

      if (!lastModified) {
        return true;
      }

      return parseHttpDate(lastModified) <= parseHttpDate(ifRange);
    }

    /**
     * @returns {string | undefined}
     */
    function getRangeHeader() {
      const rage = req.headers.range;

      if (rage && BYTES_RANGE_REGEXP.test(rage)) {
        return rage;
      }

      // eslint-disable-next-line no-undefined
      return undefined;
    }

    /**
     * @param {import("range-parser").Range} range
     * @returns {[number, number]}
     */
    function getOffsetAndLenFromRange(range) {
      const offset = range.start;
      const len = range.end - range.start + 1;

      return [offset, len];
    }

    /**
     * @param {number} offset
     * @param {number} len
     * @returns {[number, number]}
     */
    function calcStartAndEnd(offset, len) {
      const start = offset;
      const end = Math.max(offset, offset + len - 1);

      return [start, end];
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

      const { size } = /** @type {import("fs").Stats} */ (extra.stats);

      let len = size;
      let offset = 0;

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

      if (context.options.lastModified && !res.getHeader("Last-Modified")) {
        const modified =
          /** @type {import("fs").Stats} */
          (extra.stats).mtime.toUTCString();

        res.setHeader("Last-Modified", modified);
      }

      /** @type {number} */
      let start;
      /** @type {number} */
      let end;

      /** @type {undefined | Buffer | ReadStream} */
      let bufferOrStream;
      /** @type {number} */
      let byteLength;

      const rangeHeader = getRangeHeader();

      if (context.options.etag && !res.getHeader("ETag")) {
        /** @type {import("fs").Stats | Buffer | ReadStream | undefined} */
        let value;

        if (context.options.etag === "weak") {
          value = /** @type {import("fs").Stats} */ (extra.stats);
        } else {
          if (rangeHeader) {
            const parsedRanges =
              /** @type {import("range-parser").Ranges | import("range-parser").Result} */
              (parseRangeHeaders(`${size}|${rangeHeader}`));

            if (
              parsedRanges !== -2 &&
              parsedRanges !== -1 &&
              parsedRanges.length === 1
            ) {
              [offset, len] = getOffsetAndLenFromRange(parsedRanges[0]);
            }
          }

          [start, end] = calcStartAndEnd(offset, len);

          try {
            const result = createReadStreamOrReadFileSync(
              filename,
              context.outputFileSystem,
              start,
              end,
            );

            value = result.bufferOrStream;
            ({ bufferOrStream, byteLength } = result);
          } catch (_err) {
            // Ignore here
          }
        }

        if (value) {
          // eslint-disable-next-line global-require
          const result = await require("./utils/etag")(value);

          // Because we already read stream, we can cache buffer to avoid extra read from fs
          if (result.buffer) {
            bufferOrStream = result.buffer;
          }

          res.setHeader("ETag", result.hash);
        }
      }

      // Conditional GET support
      if (isConditionalGET()) {
        if (isPreconditionFailure()) {
          sendError(412, {
            modifyResponseData: context.options.modifyResponseData,
          });

          return;
        }

        // For Koa
        if (res.statusCode === 404) {
          setStatusCode(res, 200);
        }

        if (
          isCachable() &&
          isFresh({
            etag: /** @type {string | undefined} */ (res.getHeader("ETag")),
            "last-modified":
              /** @type {string | undefined} */
              (res.getHeader("Last-Modified")),
          })
        ) {
          setStatusCode(res, 304);

          // Remove content header fields
          res.removeHeader("Content-Encoding");
          res.removeHeader("Content-Language");
          res.removeHeader("Content-Length");
          res.removeHeader("Content-Range");
          res.removeHeader("Content-Type");
          res.end();

          return;
        }
      }

      if (rangeHeader) {
        let parsedRanges =
          /** @type {import("range-parser").Ranges | import("range-parser").Result | []} */
          (parseRangeHeaders(`${size}|${rangeHeader}`));

        // If-Range support
        if (!isRangeFresh()) {
          parsedRanges = [];
        }

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

          // When strong Etag generation was enabled, we calculate it there
          if (typeof offset === "undefined") {
            [offset, len] = getOffsetAndLenFromRange(parsedRanges[0]);
          }
        }
      }

      // When strong Etag generation is enabled we already read file, so we can skip extra fs call
      if (!bufferOrStream) {
        [start, end] = calcStartAndEnd(offset, len);

        try {
          ({ bufferOrStream, byteLength } = createReadStreamOrReadFileSync(
            filename,
            context.outputFileSystem,
            start,
            end,
          ));
        } catch (_ignoreError) {
          await goNext();

          return;
        }
      }

      if (context.options.modifyResponseData) {
        ({ data: bufferOrStream, byteLength } =
          context.options.modifyResponseData(
            req,
            res,
            bufferOrStream,
            // @ts-ignore
            byteLength,
          ));
      }

      // @ts-ignore
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
