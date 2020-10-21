import type express from 'express';
import parseRange from 'range-parser';
import type { WebpackDevMiddlewareContext } from '../types';

export default function handleRangeHeaders(
  context: WebpackDevMiddlewareContext,
  content: Buffer,
  req: express.Request,
  res: express.Response
): Buffer {
  // assumes express API. For other servers, need to add logic to access
  // alternative header APIs
  res.set('Accept-Ranges', 'bytes');

  const range = req.get('range');

  if (range) {
    const ranges = parseRange(content.length, range);

    // unsatisfiable
    if (ranges === -1) {
      res.set('Content-Range', `bytes */${content.length}`);
      res.status(416);
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
      res.status(206);
      const [firstRange] = ranges;
      res.set(
        'Content-Range',
        `bytes ${firstRange.start}-${firstRange.end}/${length}`
      );

      content = content.slice(firstRange.start, firstRange.end + 1);
    }
  }

  return content;
}
