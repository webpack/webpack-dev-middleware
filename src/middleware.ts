import path from 'path';

import type express from 'express';
import mime from 'mime-types';

import getFilenameFromUrl from './utils/getFilenameFromUrl';
import handleRangeHeaders from './utils/handleRangeHeaders';
import ready from './utils/ready';
import type { WebpackDevMiddlewareContext } from './types';

export default function wrapper(
  context: WebpackDevMiddlewareContext
): express.RequestHandler {
  return async function middleware(req, res, next) {
    const acceptedMethods = context.options.methods || ['GET', 'HEAD'];
    // fixes #282. credit @cexoso. in certain edge situations res.locals is undefined.
    res.locals = res.locals || {};

    if (!acceptedMethods.includes(req.method)) {
      await goNext();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    ready(context, processRequest, req);

    async function goNext() {
      if (!context.options.serverSideRender) {
        return next();
      }

      return new Promise((resolve) => {
        ready(
          context,
          () => {
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
      let content: Buffer;

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

      if (!res.get('Content-Type')) {
        // content-type name(like application/javascript; charset=utf-8) or false
        const contentType = mime.contentType(path.extname(filename));

        if (contentType) {
          res.set('Content-Type', contentType);
        }
      }

      if (headers) {
        for (const name of Object.keys(headers)) {
          res.set(name, headers[name]);
        }
      }

      content = handleRangeHeaders(context, content, req, res);
      res.send(content);
    }
  };
}
