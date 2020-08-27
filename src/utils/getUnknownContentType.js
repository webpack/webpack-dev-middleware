import mime from 'mime-types';

export default function getUnknownContentType(content) {
  return Buffer.isBuffer(content)
    ? mime.contentType('bin')
    : mime.contentType('html');
}
