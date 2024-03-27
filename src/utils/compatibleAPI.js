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
 * @template {ServerResponse} Response
 * @param {Response & ExpectedResponse} res
 * @param {import("fs").ReadStream} bufferOrStream
 */
function pipe(res, bufferOrStream) {
  // Pseudo API and Koa API
  if (
    typeof (/** @type {Response & ExpectedResponse} */ (res).pipeInto) ===
    "function"
  ) {
    // Writable stream into Readable stream
    res.pipeInto(bufferOrStream);
    return;
  }

  // Node.js API and Express API and Hapi API
  bufferOrStream.pipe(res);
}

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Response & ExpectedResponse} res
 * @param {string | Buffer} bufferOrStream
 */
function send(res, bufferOrStream) {
  // Pseudo API and Express API and Koa API
  if (typeof res.send === "function") {
    res.send(bufferOrStream);
    return;
  }

  res.end(bufferOrStream);
}

module.exports = { setStatusCode, send, pipe };
