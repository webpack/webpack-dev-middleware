import parseRange from 'range-parser';

export default function handleRangeHeaders(content, req, res) {
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
    }

    // valid (syntactically invalid/multiple ranges are treated as a
    // regular response)
    if (ranges !== -2 && ranges.length === 1) {
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
