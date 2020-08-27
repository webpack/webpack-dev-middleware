import getContentLength from './getContentLength';
import getUnknownContentType from './getUnknownContentType';

export default function sendContent(res, content) {
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
