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
 * @param {Record<string, number | string | string[] | undefined>} headers
 */
function setHeadersForResponse(res, headers) {
  const keys = Object.keys(headers);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = headers[key];

    if (typeof value !== "undefined") {
      setHeaderForResponse(res, key, value);
    }
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
  416: "Range Not Satisfiable",
  500: "Internal Server Error",
};

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Request} req response
 * @param {Response} res response
 * @param {number} status status
 * @param {Partial<SendOptions<Request, Response>>=} options options
 * @returns {void}
 */
function sendError(req, res, status, options) {
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
  clearHeadersForResponse(res);

  if (options && options.headers) {
    setHeadersForResponse(res, options.headers);
  }

  // Send basic response
  setStatusCode(res, status);
  setHeaderForResponse(res, "Content-Type", "text/html; charset=UTF-8");
  setHeaderForResponse(res, "Content-Security-Policy", "default-src 'none'");
  setHeaderForResponse(res, "X-Content-Type-Options", "nosniff");

  let byteLength = Buffer.byteLength(document);

  if (options && options.modifyResponseData) {
    ({ data: document, byteLength } =
      /** @type {{data: string, byteLength: number }} */
      (options.modifyResponseData(req, res, document, byteLength)));
  }

  setHeaderForResponse(res, "Content-Length", byteLength);

  res.end(document);
}

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @typedef {Object} SendOptions send error options
 * @property {Record<string, number | string | string[] | undefined>=} headers headers
 * @property {import("../index").ModifyResponseData<Request, Response>=} modifyResponseData modify response data callback
 * @property {import("../index").OutputFileSystem} outputFileSystem modify response data callback
 */

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Request} req
 * @param {Response} res
 * @param {string} filename
 * @param {number} start
 * @param {number} end
 * @param {() => Promise<void>} goNext
 * @param {SendOptions<Request, Response>} options
 */
async function send(req, res, filename, start, end, goNext, options) {
  const isFsSupportsStream =
    typeof options.outputFileSystem.createReadStream === "function";

  let bufferOrStream;
  let byteLength;

  try {
    if (isFsSupportsStream) {
      bufferOrStream =
        /** @type {import("fs").createReadStream} */
        (options.outputFileSystem.createReadStream)(filename, {
          start,
          end,
        });
      byteLength = end - start + 1;
    } else {
      bufferOrStream = /** @type {import("fs").readFileSync} */ (
        options.outputFileSystem.readFileSync
      )(filename);
      ({ byteLength } = bufferOrStream);
    }
  } catch (_ignoreError) {
    await goNext();

    return;
  }

  if (options.modifyResponseData) {
    ({ data: bufferOrStream, byteLength } = options.modifyResponseData(
      req,
      res,
      bufferOrStream,
      byteLength,
    ));
  }

  if (
    typeof (/** @type {import("fs").ReadStream} */ (bufferOrStream).pipe) ===
    "function"
  ) {
    setHeaderForResponse(res, "Content-Length", byteLength);

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    /** @type {import("fs").ReadStream} */
    (bufferOrStream).pipe(res);

    // Cleanup
    const cleanup = () => {
      destroyStream(
        /** @type {import("fs").ReadStream} */ (bufferOrStream),
        true,
      );
    };

    // Response finished, cleanup
    onFinishedStream(res, cleanup);

    // error handling
    /** @type {import("fs").ReadStream} */
    (bufferOrStream).on("error", (error) => {
      // clean up stream early
      cleanup();

      // Handle Error
      switch (/** @type {NodeJS.ErrnoException} */ (error).code) {
        case "ENAMETOOLONG":
        case "ENOENT":
        case "ENOTDIR":
          sendError(req, res, 404, options);
          break;
        default:
          sendError(req, res, 500, options);
          break;
      }
    });

    return;
  }

  // Express API
  if (
    typeof (/** @type {Response & ExpectedResponse} */ (res).send) ===
    "function"
  ) {
    /** @type {Response & ExpectedResponse} */
    (res).send(bufferOrStream);
    return;
  }

  // Only Node.js API used
  res.setHeader("Content-Length", byteLength);

  if (req.method === "HEAD") {
    res.end();
  } else {
    res.end(bufferOrStream);
  }
}

module.exports = {
  getHeaderNames,
  getHeaderFromRequest,
  getHeaderFromResponse,
  setHeaderForResponse,
  setStatusCode,
  send,
  sendError,
};
