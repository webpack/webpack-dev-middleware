import path from 'path';

import mime from 'mime-types';

import DevMiddlewareError from './DevMiddlewareError';
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
            res.locals.webpack = {
              stats: context.stats,
              outputFileSystem: context.outputFileSystem,
            };

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
      function processRequest(stats) {
        const possibleFilePaths = getFilenameFromUrl(context, req.url, stats);

        if (possibleFilePaths.length === 0) {
          return goNext();
        }

        let filePath;
        let stat;

        for (const possibleFilePath of possibleFilePaths) {
          try {
            stat = context.outputFileSystem.statSync(possibleFilePath);
          } catch (_ignoreError) {
            // eslint-disable-next-line no-continue
            continue;
          }

          filePath = possibleFilePath;
        }

        try {
          if (!stat.isFile()) {
            if (stat.isDirectory()) {
              let { index } = context.options;

              // eslint-disable-next-line no-undefined
              if (index === undefined || index === true) {
                index = 'index.html';
              } else if (!index) {
                throw new DevMiddlewareError('next');
              }

              filePath = path.join(filePath, index);
              stat = context.outputFileSystem.statSync(filePath);

              if (!stat.isFile()) {
                throw new DevMiddlewareError('next');
              }
            } else {
              throw new DevMiddlewareError('next');
            }
          }
        } catch (_ignoreError) {
          return resolve(goNext());
        }

        // server content
        let content;

        try {
          content = context.outputFileSystem.readFileSync(filePath);
        } catch (_ignoreError) {
          return resolve(goNext());
        }

        content = handleRangeHeaders(content, req, res);

        if (!res.get('Content-Type')) {
          const contentType = mime.contentType(path.extname(filePath));

          if (contentType) {
            res.set('Content-Type', contentType);
          }
        }

        const { headers } = context.options;

        if (headers) {
          for (const name in headers) {
            if ({}.hasOwnProperty.call(headers, name)) {
              res.setHeader(name, context.options.headers[name]);
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
