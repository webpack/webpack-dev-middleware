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

const matchHtmlRegExp = /["'&<>]/;

/**
 * @param {string} string raw HTML
 * @returns {string} escaped HTML
 */
function escapeHtml(string) {
  const str = `${string}`;
  const match = matchHtmlRegExp.exec(str);

  if (!match) {
    return str;
  }

  let escape;
  let html = "";
  let index = 0;
  let lastIndex = 0;

  for ({ index } = match; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      // "
      case 34:
        escape = "&quot;";
        break;
      // &
      case 38:
        escape = "&amp;";
        break;
      // '
      case 39:
        escape = "&#39;";
        break;
      // <
      case 60:
        escape = "&lt;";
        break;
      // >
      case 62:
        escape = "&gt;";
        break;
      default:
        // eslint-disable-next-line no-continue
        continue;
    }

    if (lastIndex !== index) {
      html += str.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
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
 * @typedef {Object} SendOptions send error options
 * @property {Record<string, number | string | string[] | undefined>=} headers headers
 * @property {import("../index").ModifyResponseData<Request, Response>=} modifyResponseData modify response data callback
 * @property {import("../index").OutputFileSystem} outputFileSystem modify response data callback
 */

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
  setHeaderForResponse(res, "Content-Type", "text/html; charset=utf-8");
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

module.exports = {
  getHeaderNames,
  getHeaderFromRequest,
  getHeaderFromResponse,
  setHeaderForResponse,
  setStatusCode,
  send,
  sendError,
};
