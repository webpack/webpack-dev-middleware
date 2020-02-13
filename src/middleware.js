import path from 'path';

import mime from 'mime-types';

import getFilenameFromUrl from './utils/getFilenameFromUrl';
import handleRangeHeaders from './utils/handleRangeHeaders';
import ready from './utils/ready';

export default function wrapper(context) {
  return function middleware(req, res, next) {
    // fixes #282. credit @cexoso. in certain edge situations res.locals is undefined.
    // eslint-disable-next-line no-param-reassign
    res.locals = res.locals || {};

    function goNext() {
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

    const acceptedMethods = context.options.methods || ['GET', 'HEAD'];

    if (acceptedMethods.indexOf(req.method) === -1) {
      return goNext();
    }

    return new Promise((resolve) => {
      // eslint-disable-next-line consistent-return
      function processRequest() {
        const filename = getFilenameFromUrl(context, req.url);

        if (!filename) {
          return resolve(goNext());
        }

        let content;

        try {
          content = context.outputFileSystem.readFileSync(filename);
        } catch (_ignoreError) {
          return resolve(goNext());
        }

        content = handleRangeHeaders(content, req, res);

        if (!res.get('Content-Type')) {
          const contentType = mime.contentType(path.extname(filename));

          if (contentType) {
            res.set('Content-Type', contentType);
          }
        }

        const { headers } = context.options;

        if (headers) {
          for (const name in headers) {
            if ({}.hasOwnProperty.call(headers, name)) {
              res.set(name, context.options.headers[name]);
            }
          }
        }

        res.send(content);

        resolve();
      }

      ready(context, processRequest, req);
    });
  };
}
