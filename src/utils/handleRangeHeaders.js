import parseRange from 'range-parser';

export default function handleRangeHeaders(context, content, req, res) {
  // assumes express API. For other servers, need to add logic to access
  // alternative header APIs
  res.setHeader('Accept-Ranges', 'bytes');

  if (req.headers.range) {
    const ranges = parseRange(content.length, req.headers.range);

    // unsatisfiable
    if (ranges === -1) {
      res.setHeader('Content-Range', `bytes */${content.length}`);
      // eslint-disable-next-line no-param-reassign
      res.statusCode = 416;
    } else if (ranges === -2) {
      // malformed header treated as regular response
      context.logger.error(
        'A malformed Range header was provided. A regular response will be sent for this request.'
      );
    } else if (ranges.length !== 1) {
      // multiple ranges treated as regular response
      context.logger.error(
        'A Range header with multiple ranges was provided. Multiple ranges are not supported, so a regular response will be sent for this request.'
      );
    } else {
      // valid range header
      const { length } = content;

      // Content-Range
      // eslint-disable-next-line no-param-reassign
      res.statusCode = 206;
      res.setHeader(
        'Content-Range',
        `bytes ${ranges[0].start}-${ranges[0].end}/${length}`
      );

      // eslint-disable-next-line no-param-reassign
      content = content.slice(ranges[0].start, ranges[0].end + 1);
    }
  }

  return content;
}
