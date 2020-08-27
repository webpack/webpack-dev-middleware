export default function getContentLength(content) {
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
