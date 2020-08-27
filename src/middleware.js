import path from 'path';

import mime from 'mime-types';

import getFilenameFromUrl from './utils/getFilenameFromUrl';
import handleRangeHeaders from './utils/handleRangeHeaders';
import ready from './utils/ready';
import getContentLength from './utils/getContentLength';
import getUnknownContentType from './utils/getUnknownContentType';

export default function wrapper(context) {
  return async function middleware(req, res, next) {
    const acceptedMethods = context.options.methods || ['GET', 'HEAD'];
    // fixes #282. credit @cexoso. in certain edge situations res.locals is undefined.
    // eslint-disable-next-line no-param-reassign
    res.locals = res.locals || {};

    if (!acceptedMethods.includes(req.method)) {
      await goNext();
      return;
    }

    ready(context, processRequest, req);

    async function goNext() {
      if (!context.options.serverSideRender) {
        return next();
      }

      return new Promise((resolve) => {
        ready(
          context,
          () => {
            // eslint-disable-next-line no-param-reassign
            res.locals.webpack = { devMiddleware: context };

            resolve(next());
          },
          req
        );
      });
    }

    async function processRequest() {
      const filename = getFilenameFromUrl(context, req.url);
      const { headers } = context.options;
      let content;

      if (!filename) {
        await goNext();
        return;
      }

      try {
        content = context.outputFileSystem.readFileSync(filename);
      } catch (_ignoreError) {
        await goNext();
        return;
      }

      if (!res.getHeader('Content-Type')) {
        // content-type name(like application/javascript; charset=utf-8) or false
        const contentType = mime.contentType(path.extname(filename));

        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }
      }

      if (headers) {
        for (const name of Object.keys(headers)) {
          res.setHeader(name, headers[name]);
        }
      }

      // Buffer
      content = handleRangeHeaders(context, content, req, res);

      // send Buffer
      if (res.send) {
        res.send(content);
      } else {
        const contentLength = getContentLength(content);
        res.setHeader('Content-Length', contentLength);
        if (!res.getHeader('Content-Type')) {
          const unknownContentType = getUnknownContentType(content);
          res.setHeader('Content-Type', unknownContentType);
        }

        res.end(content);
      }
    }
  };
}
