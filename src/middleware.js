const path = require("path");

const mime = require("mime-types");

const getFilenameFromUrl = require("./utils/getFilenameFromUrl");
const {
  getHeaderFromRequest,
  getHeaderFromResponse,
  setHeaderForResponse,
  setStatusCode,
  send,
  sendError,
} = require("./utils/compatibleAPI");
const ready = require("./utils/ready");

/** @typedef {import("./index.js").NextFunction} NextFunction */
/** @typedef {import("./index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("./index.js").ServerResponse} ServerResponse */

/**
 * @param {string} type
 * @param {number} size
 * @param {import("range-parser").Range} [range]
 * @returns {string}
 */
function getValueContentRangeHeader(type, size, range) {
  return `${type} ${range ? `${range.start}-${range.end}` : "*"}/${size}`;
}

const BYTES_RANGE_REGEXP = /^ *bytes/i;

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("./index.js").Context<Request, Response>} context
 * @return {import("./index.js").Middleware<Request, Response>}
 */
function wrapper(context) {
  return async function middleware(req, res, next) {
    const acceptedMethods = context.options.methods || ["GET", "HEAD"];

    // fixes #282. credit @cexoso. in certain edge situations res.locals is undefined.
    // eslint-disable-next-line no-param-reassign
    res.locals = res.locals || {};

    if (req.method && !acceptedMethods.includes(req.method)) {
      await goNext();

      return;
    }

    ready(context, processRequest, req);

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

    async function processRequest() {
      /** @type {import("./utils/getFilenameFromUrl").Extra} */
      const extra = {};
      const filename = getFilenameFromUrl(
        context,
        /** @type {string} */ (req.url),
        extra,
      );

      if (!filename) {
        await goNext();

        return;
      }

      let { headers } = context.options;

      if (typeof headers === "function") {
        // @ts-ignore
        headers = headers(req, res, context);
      }

      /**
       * @type {{key: string, value: string | number}[]}
       */
      const allHeaders = [];

      if (typeof headers !== "undefined") {
        if (!Array.isArray(headers)) {
          // eslint-disable-next-line guard-for-in
          for (const name in headers) {
            // @ts-ignore
            allHeaders.push({ key: name, value: headers[name] });
          }

          headers = allHeaders;
        }

        headers.forEach(
          /**
           * @param {{key: string, value: any}} header
           */
          (header) => {
            setHeaderForResponse(res, header.key, header.value);
          },
        );
      }

      if (!getHeaderFromResponse(res, "Content-Type")) {
        // content-type name(like application/javascript; charset=utf-8) or false
        const contentType = mime.contentType(path.extname(filename));

        // Only set content-type header if media type is known
        // https://tools.ietf.org/html/rfc7231#section-3.1.1.5
        if (contentType) {
          setHeaderForResponse(res, "Content-Type", contentType);
        } else if (context.options.mimeTypeDefault) {
          setHeaderForResponse(
            res,
            "Content-Type",
            context.options.mimeTypeDefault,
          );
        }
      }

      if (!getHeaderFromResponse(res, "Accept-Ranges")) {
        setHeaderForResponse(res, "Accept-Ranges", "bytes");
      }

      const rangeHeader = getHeaderFromRequest(req, "range");

      let len = /** @type {import("fs").Stats} */ (extra.stats).size;
      let offset = 0;

      if (rangeHeader && BYTES_RANGE_REGEXP.test(rangeHeader)) {
        // eslint-disable-next-line global-require
        const parsedRanges = require("range-parser")(len, rangeHeader, {
          combine: true,
        });

        if (parsedRanges === -1) {
          context.logger.error("Unsatisfiable range for 'Range' header.");

          setHeaderForResponse(
            res,
            "Content-Range",
            getValueContentRangeHeader("bytes", len),
          );

          sendError(req, res, 416, {
            headers: {
              "Content-Range": res.getHeader("Content-Range"),
            },
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
          setHeaderForResponse(
            res,
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

      send(req, res, filename, start, end, goNext, {
        modifyResponseData: context.options.modifyResponseData,
        outputFileSystem: context.outputFileSystem,
      });
    }
  };
}

module.exports = wrapper;
