/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */

/**
 * @typedef {Object} ExpectedResponse
 * @property {(status: number) => void} [status]
 * @property {(data: any) => void} [send]
 * @property {(data: any) => void} [pipeInto]
 */

/**
 * @template {ServerResponse & ExpectedResponse} Response
 * @param {Response} res
 * @param {number} code
 */
function setStatusCode(res, code) {
  // Pseudo API
  if (typeof res.status === "function") {
    res.status(code);

    return;
  }

  // Node.js API
  // eslint-disable-next-line no-param-reassign
  res.statusCode = code;
}

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Request} req
 * @param {Response & ExpectedResponse} res
 * @param {import("fs").ReadStream} bufferOrStream
 */
function pipe(req, res, bufferOrStream) {
  // Pseudo API and Koa API
  if (
    typeof (/** @type {Response & ExpectedResponse} */ (res).pipeInto) ===
    "function"
  ) {
    // Writable stream into Readable stream
    res.pipeInto(bufferOrStream);
  }
  // Node.js API and Express API and Hapi API
  else {
    bufferOrStream.pipe(res);
  }

  if (req.method === "HEAD") {
    res.end();
  }
}

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Request} req
 * @param {Response & ExpectedResponse} res
 * @param {string | Buffer} bufferOrStream
 * @param {number} byteLength
 */
function send(req, res, bufferOrStream, byteLength) {
  // Pseudo API and Express API and Koa API
  if (typeof res.send === "function") {
    res.send(bufferOrStream);

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
  pipe,
};
