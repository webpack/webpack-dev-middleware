const onFinishedStream = require("on-finished");

const escapeHtml = require("./escapeHtml");

/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/** @typedef {import("fs").ReadStream} ReadStream */

/**
 * @typedef {Object} ExpectedRequest
 * @property {(name: string) => string | undefined} get
 */

/**
 * @typedef {Object} ExpectedResponse
 * @property {(status: number) => void} [status]
 * @property {(data: any) => void} [send]
 * @property {(data: any) => void} [pipeInto]
 */

/**
 * @template {ServerResponse} Response
 * @param {Response} res
 * @param {number} code
 */
function setStatusCode(res, code) {
  // Pseudo API
  if (
    typeof (/** @type {Response & ExpectedResponse} */ (res).status) ===
    "function"
  ) {
    /** @type {Response & ExpectedResponse} */
    (res).status(code);

    return;
  }

  // Node.js API
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
  400: "Bad Request",
  403: "Forbidden",
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

  /** @type {string | Buffer | ReadStream} */
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

      // Handle files with zero bytes
      byteLength = end === 0 ? 0 : end - start + 1;
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
          sendError(req, res, 404, options);
          break;
        default:
          sendError(req, res, 500, options);
          break;
      }
    });

    res.setHeader("Content-Length", byteLength);

    // Pseudo API and Koa API
    if (
      typeof (/** @type {Response & ExpectedResponse} */ (res).pipeInto) ===
      "function"
    ) {
      // Writable stream into Readable stream
      /** @type {Response & ExpectedResponse} */
      (res).pipeInto(bufferOrStream);
    }
    // Node.js API and Express API and Hapi API
    else {
      /** @type {import("fs").ReadStream} */
      (bufferOrStream).pipe(res);
    }

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    // Response finished, cleanup
    onFinishedStream(res, cleanup);

    return;
  }

  // Pseudo API and Express API and Koa API
  if (
    typeof (/** @type {Response & ExpectedResponse} */ (res).send) ===
    "function"
  ) {
    /** @type {Response & ExpectedResponse} */
    (res).send(bufferOrStream);
    return;
  }

  // Only Node.js API and Hapi API
  res.setHeader("Content-Length", byteLength);

  if (req.method === "HEAD") {
    res.end();
  } else {
    res.end(bufferOrStream);
  }
}

module.exports = {
  setStatusCode,
  send,
  sendError,
};
