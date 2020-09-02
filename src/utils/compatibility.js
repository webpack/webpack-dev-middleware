import mime from 'mime-types';

export function resGetHeader(res, header) {
  if (res.get) {
    return res.get(header);
  }
  return res.getHeader(header);
}
export function resSetHeader(res, header, value) {
  if (res.set) {
    return res.set(header, value);
  }
  return res.setHeader(header, value);
}
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

export function getUnknownContentType(content) {
  return Buffer.isBuffer(content)
    ? mime.contentType('bin')
    : mime.contentType('html');
}

export function sendContent(res, content) {
  if (res.send) {
    return res.send(content);
  }

  const contentLength = getContentLength(content);
  res.setHeader('Content-Length', contentLength);

  if (!res.getHeader('Content-Type')) {
    const unknownContentType = getUnknownContentType(content);
    res.setHeader('Content-Type', unknownContentType);
  }

  return res.end(content);
}
