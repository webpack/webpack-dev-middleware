import path from 'path';

import mime from 'mime-types';

import getETag from 'etag';

import getFilenameFromUrl from './utils/getFilenameFromUrl';
import handleRangeHeaders from './utils/handleRangeHeaders';
import ready from './utils/ready';

const { hasOwnProperty } = Object.prototype;

export default function wrapper(context) {
  const { compiler } = context;
  const etagRegistry = new Map();

  function computeEtags(stats) {
    const { assets } = stats.compilation;
    for (const assetId in assets) {
      if (hasOwnProperty.call(assets, assetId)) {
        const { existsAt: fsPath } = assets[assetId];
        const etag = getETag(assets[assetId].source());
        etagRegistry.set(fsPath, etag);
      }
    }
  }

  if (compiler.hooks.done) {
    compiler.hooks.done.tap('just-ssr', computeEtags);
  } else {
    compiler.plugin('done', computeEtags);
  }

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

      const assetEtag = etagRegistry.get(filename);
      if (assetEtag) {
        const { 'if-none-match': ifNoneMatch } = req.headers;
        if (ifNoneMatch) {
          if (assetEtag === ifNoneMatch) {
            // eslint-disable-next-line no-param-reassign
            res.statusCode = 304;
            res.end();
            return;
          }
        } else {
          res.setHeader('ETag', assetEtag);
        }
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
      res.end(content);
    }
  };
}
