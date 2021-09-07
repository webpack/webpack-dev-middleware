function getHeaderNames(res) {
  return typeof res.getHeaderNames !== "function"
    ? // eslint-disable-next-line no-underscore-dangle
      Object.keys(res._headers || {})
    : res.getHeaderNames();
}

function getHeaderFromRequest(req, name) {
  // Express API
  if (typeof req.get === "function") {
    return req.get("range");
  }

  // Node.js API
  return req.headers[name];
}

function getHeaderFromResponse(res, name) {
  // Express API
  if (typeof res.get === "function") {
    return res.get(name);
  }

  // Node.js API
  return res.getHeader(name);
}

function setHeaderForResponse(res, name, value) {
  // Express API
  if (typeof res.set === "function") {
    res.set(name, value);

    return;
  }

  // Node.js API
  res.setHeader(name, value);
}

function setStatusCode(res, code) {
  if (typeof res.status === "function") {
    res.status(code);

    return;
  }

  // eslint-disable-next-line no-param-reassign
  res.statusCode = code;
}

function send(req, res, bufferOtStream, byteLength) {
  if (typeof bufferOtStream.pipe === "function") {
    setHeaderForResponse(res, "Content-Length", byteLength);

    if (req.method === "HEAD") {
      res.end();

      return;
    }

    bufferOtStream.pipe(res);

    return;
  }

  if (typeof res.send === "function") {
    res.send(bufferOtStream);

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
