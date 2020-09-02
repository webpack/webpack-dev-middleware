import mime from 'mime-types';

export function resGetHeader(res, header) {
  // for express
  if (res.get) {
    return res.get(header);
  }
  // for fastify
  return res.getHeader(header);
}

export function resSetHeader(res, header, value) {
  // for express
  if (res.set) {
    return res.set(header, value);
  }
  // for fastify
  return res.setHeader(header, value);
}

// helper to get Content-Length for fastify
export function getContentLength(content) {
  let len = 0;
  if (typeof content !== 'undefined') {
    if (Buffer.isBuffer(content)) {
      // get length of Buffer
      len = content.length;
    } else if (content.length < 1000) {
      // just calculate length
      len = Buffer.byteLength(content);
    } else {
      // convert content to Buffer and calculate
      // eslint-disable-next-line no-param-reassign
      content = Buffer.from(content);
      len = content.length;
    }
  }
  return len;
}

// helper to get Content-Type for fastify
export function getUnknownContentType(content) {
  return Buffer.isBuffer(content)
    ? mime.contentType('bin')
    : mime.contentType('html');
}

export function sendContent(res, content) {
  // for express
  if (res.send) {
    return res.send(content);
  }

  // for fastify
  const contentLength = getContentLength(content);
  resSetHeader(res, 'Content-Length', contentLength);

  if (!resGetHeader(res, 'Content-Type')) {
    const unknownContentType = getUnknownContentType(content);
    resSetHeader(res, 'Content-Type', unknownContentType);
  }

  return res.end(content);
}
