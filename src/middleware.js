import path from 'path';

import mime from 'mime';

import DevMiddlewareError from './DevMiddlewareError';
import getFilenameFromUrl from './utils/getFilenameFromUrl';
import handleRangeHeaders from './utils/handleRangeHeaders';
import ready from './utils/ready';

// Do not add a charset to the Content-Type header of these file types
// otherwise the client will fail to render them correctly.
const NonCharsetFileTypes = /\.(wasm|usdz)$/;

const HASH_REGEXP = /[0-9a-f]{10,}/;

export default function wrapper(context) {
  return function middleware(req, res, next) {
    // fixes #282. credit @cexoso. in certain edge situations res.locals is
    // undefined.
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
              stats: context.webpackStats,
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

    let filename = getFilenameFromUrl(
      context.options.publicPath,
      context.compiler,
      req.url
    );

    if (filename === false) {
      return goNext();
    }

    return new Promise((resolve) => {
      // eslint-disable-next-line consistent-return
      function processRequest() {
        try {
          let stat = context.outputFileSystem.statSync(filename);

          if (!stat.isFile()) {
            if (stat.isDirectory()) {
              let { index } = context.options;

              // eslint-disable-next-line no-undefined
              if (index === undefined || index === true) {
                index = 'index.html';
              } else if (!index) {
                throw new DevMiddlewareError('next');
              }

              filename = path.posix.join(filename, index);
              stat = context.outputFileSystem.statSync(filename);

              if (!stat.isFile()) {
                throw new DevMiddlewareError('next');
              }
            } else {
              throw new DevMiddlewareError('next');
            }
          }
        } catch (e) {
          return resolve(goNext());
        }

        // server content
        let content = context.outputFileSystem.readFileSync(filename);

        content = handleRangeHeaders(content, req, res);

        let contentType = mime.getType(filename) || '';

        if (!NonCharsetFileTypes.test(filename)) {
          contentType += '; charset=UTF-8';
        }

        if (!res.getHeader || !res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', contentType);
        }

        const { headers } = context.options;

        if (headers) {
          for (const name in headers) {
            if ({}.hasOwnProperty.call(headers, name)) {
              res.setHeader(name, context.options.headers[name]);
            }
          }
        }

        // Express automatically sets the statusCode to 200, but not all servers do (Koa).
        // eslint-disable-next-line no-param-reassign
        res.statusCode = res.statusCode || 200;

        if (res.send) {
          res.send(content);
        } else {
          res.end(content);
        }

        resolve();
      }

      if (
        context.options.lazy &&
        (!context.options.filename || context.options.filename.test(filename))
      ) {
        context.rebuild();
      }

      if (HASH_REGEXP.test(filename)) {
        try {
          if (context.outputFileSystem.statSync(filename).isFile()) {
            processRequest();

            return;
          }
        } catch (_error) {
          // Ignore error
        }
      }

      ready(context, processRequest, req);
    });
  };
}
