/** @typedef {import("../index.js").Request} Request */
/** @typedef {import("../index.js").Response} Response */
/** @typedef {import("express").Request} ExpressRequest */
/** @typedef {import("express").Response} ExpressResponse */

/**
 * @param {Response} res
 * @returns {string[]}
 */
function getHeaderNames(res) {
  if (typeof res.getHeaderNames !== "function") {
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    return Object.keys(/** @type {ExpressResponse} */ (res)._headers || {});
  }
  
  
  return res.getHeaderNames();
}

/**
 * @param {Request} req
 * @param {string} name
 * @returns {string | undefined}
 */
function getHeaderFromRequest(req, name) {
  // Express API
  if (typeof (/** @type {ExpressRequest} */ (req).get) === "function") {
    return /** @type {ExpressRequest} */ (req).get("range");
  }

  // Node.js API
  // @ts-ignore
  return req.headers[name];
}

/**
 * @param {Response} res
 * @param {string} name
 * @returns {number | string | string[] | undefined}
 */
function getHeaderFromResponse(res, name) {
  // Express API
  if (typeof (/** @type {ExpressResponse} */ (res).get) === "function") {
    return /** @type {ExpressResponse} */ (res).get(name);
  }

  // Node.js API
  return res.getHeader(name);
}

/**
 * @param {Response} res
 * @param {string} name
 * @param {number | string | string[]} value
 * @returns {void}
 */
function setHeaderForResponse(res, name, value) {
  // Express API
  if (typeof (/** @type {ExpressResponse} */ (res).set) === "function") {
    /** @type {ExpressResponse} */
    (res).set(name, typeof value === "number" ? String(value) : value);

    return;
  }

  // Node.js API
  res.setHeader(name, value);
}

/**
 * @param {Response} res
 * @param {number} code
 */
function setStatusCode(res, code) {
  if (typeof (/** @type {ExpressResponse} */ (res).status) === "function") {
    /** @type {ExpressResponse} */
    (res).status(code);

    return;
  }

  // eslint-disable-next-line no-param-reassign
  res.statusCode = code;
}

/**
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

  if (typeof (/** @type {ExpressResponse} */ (res).send) === "function") {
    /** @type {ExpressResponse} */ (res).send(bufferOtStream);

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
