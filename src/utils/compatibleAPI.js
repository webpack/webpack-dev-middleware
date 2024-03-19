 
const onFinishedStream = require("on-finished");

const escapeHtml = require("./escapeHtml");

/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */

/**
 * @typedef {Object} ExpectedRequest
 * @property {(name: string) => string | undefined} get
 */

/**
 * @typedef {Object} ExpectedResponse
 * @property {(name: string) => string | string[] | undefined} get
 * @property {(name: string, value: number | string | string[]) => void} set
 * @property {(status: number) => void} status
 * @property {(data: any) => void} send
 */

/**
 * @template {ServerResponse} Response
 * @param {Response} res
 * @returns {string[]}
 */
function getHeaderNames(res) {
  if (typeof res.getHeaderNames !== "function") {
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    return Object.keys(res._headers || {});
  }

  return res.getHeaderNames();
}

/**
 * @template {IncomingMessage} Request
 * @param {Request} req
 * @param {string} name
 * @returns {string | undefined}
 */
function getHeaderFromRequest(req, name) {
  // Express API
  if (
    typeof (/** @type {Request & ExpectedRequest} */ (req).get) === "function"
  ) {
    return /** @type {Request & ExpectedRequest} */ (req).get(name);
  }

  // Node.js API
  // @ts-ignore
  return req.headers[name];
}

/**
 * @template {ServerResponse} Response
 * @param {Response} res
 * @param {string} name
 * @returns {number | string | string[] | undefined}
 */
function getHeaderFromResponse(res, name) {
  // Express API
  if (
    typeof (/** @type {Response & ExpectedResponse} */ (res).get) === "function"
  ) {
    return /** @type {Response & ExpectedResponse} */ (res).get(name);
  }

  // Node.js API
  return res.getHeader(name);
}

/**
 * @template {ServerResponse} Response
 * @param {Response} res
 * @param {string} name
 * @param {number | string | string[]} value
 * @returns {void}
 */
function setHeaderForResponse(res, name, value) {
  // Express API
  if (
    typeof (/** @type {Response & ExpectedResponse} */ (res).set) === "function"
  ) {
    /** @type {Response & ExpectedResponse} */
    (res).set(name, typeof value === "number" ? String(value) : value);

    return;
  }

  // Node.js API
  res.setHeader(name, value);
}

/**
 * @template {ServerResponse} Response
 * @param {Response} res
 * @param {Record<string, number | string | string[]>} headers
 */
function setHeadersForResponse(res, headers) {
  const keys = Object.keys(headers);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    setHeaderForResponse(res, key, headers[key]);
  }
}

/**
 * @template {ServerResponse} Response
 * @param {Response} res
 */
function clearHeadersForResponse(res) {
  const headers = getHeaderNames(res);

  for (let i = 0; i < headers.length; i++) {
    res.removeHeader(headers[i]);
  }
}

/**
 * @template {ServerResponse} Response
 * @param {Response} res
 * @param {number} code
 */
function setStatusCode(res, code) {
  if (
    typeof (/** @type {Response & ExpectedResponse} */ (res).status) ===
    "function"
  ) {
    /** @type {Response & ExpectedResponse} */
    (res).status(code);

    return;
  }

  // eslint-disable-next-line no-param-reassign
  res.statusCode = code;
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
  404: "Not Found",
  500: "Internal Server Error",
};

/**
 * @template {ServerResponse} Response
 * @param {Response} res response
 * @param {number} status status
 * @param {Error & { headers?: Record<string, number | string | string[]>}} err error
 * @returns {void}
 */
function sendError(res, status, err) {
  const msg = statuses[status] || String(status);
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>${escapeHtml(msg)}</pre>
</body>
</html>`;

  // Clear existing headers
  clearHeadersForResponse(res);

  // Add error headers
  if (err && err.headers) {
    setHeadersForResponse(res, err.headers);
  }

  // Send basic response
  setStatusCode(res, status);
  setHeaderForResponse(res, "Content-Type", "text/html; charset=UTF-8");
  setHeaderForResponse(res, "Content-Length", Buffer.byteLength(doc));
  setHeaderForResponse(res, "Content-Security-Policy", "default-src 'none'");
  setHeaderForResponse(res, "X-Content-Type-Options", "nosniff");

  res.end(doc);
}

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Request} req
 * @param {Response} res
 * @param {string | Buffer | import("fs").ReadStream} bufferOtStream
 * @param {number} byteLength
 */
function send(req, res, bufferOtStream, byteLength) {
  if (
    typeof (/** @type {import("fs").ReadStream} */ (bufferOtStream).pipe) ===
    "function"
  ) {
    setHeaderForResponse(res, "Content-Length", byteLength);

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    /** @type {import("fs").ReadStream} */
    (bufferOtStream).pipe(res);

    // Cleanup
    const cleanup = () => {
      destroyStream(
        /** @type {import("fs").ReadStream} */ (bufferOtStream),
        true,
      );
    };

    // Response finished, cleanup
    onFinishedStream(res, cleanup);

    // error handling
    /** @type {import("fs").ReadStream} */
    (bufferOtStream).on("error", (error) => {
      // clean up stream early
      cleanup();

      // Handle Error
      switch (/** @type {NodeJS.ErrnoException} */ (error).code) {
        case "ENAMETOOLONG":
        case "ENOENT":
        case "ENOTDIR":
          sendError(res, 404, error);
          break;
        default:
          sendError(res, 500, error);
          break;
      }
    });

    return;
  }

  if (
    typeof (/** @type {Response & ExpectedResponse} */ (res).send) ===
    "function"
  ) {
    /** @type {Response & ExpectedResponse} */
    (res).send(bufferOtStream);
    return;
  }

  // Only Node.js API used
  res.setHeader("Content-Length", byteLength);

  if (req.method === "HEAD") {
    res.end();
  } else {
    res.end(bufferOtStream);
  }
}

module.exports = {
  getHeaderNames,
  getHeaderFromRequest,
  getHeaderFromResponse,
  setHeaderForResponse,
  setStatusCode,
  send,
};
