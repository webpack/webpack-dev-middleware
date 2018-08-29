'use strict';

const mime = require('mime');
const urlJoin = require('url-join');
const DevMiddlewareError = require('./DevMiddlewareError');
const { getFilenameFromUrl, handleRangeHeaders, handleRequest, ready } = require('./util');

module.exports = function wrapper(context) {
  return function middleware(req, res, next) {
    // fixes #282. credit @cexoso. in certain edge situations res.locals is
    // undefined.
    res.locals = res.locals || {};

    function goNext() {
      if (!context.options.serverSideRender) {
        return next();
      }

      return new Promise(((resolve) => {
        ready(context, () => {
          res.locals.webpackStats = context.webpackStats;
          resolve(next());
        }, req);
      }));
    }

    const acceptedMethods = context.options.methods || ['GET'];
    if (acceptedMethods.indexOf(req.method) === -1) {
      return goNext();
    }

    let filename = getFilenameFromUrl(context.options.publicPath, context.compiler, req.url);

    if (filename === false) {
      return goNext();
    }

    return new Promise(((resolve) => {
      handleRequest(context, filename, processRequest, req);
      function processRequest() {
        let notFound;
        try {
          let stat = context.fs.statSync(filename);

          if (!stat.isFile()) {
            if (stat.isDirectory()) {
              let { index } = context.options;

              if (index === undefined || index === true) {
                index = 'index.html';
              } else if (!index) {
                throw new DevMiddlewareError('next');
              }

              filename = urlJoin(filename, index);
              stat = context.fs.statSync(filename);
              if (!stat.isFile()) {
                throw new DevMiddlewareError('next');
              }
            } else {
              throw new DevMiddlewareError('next');
            }
          }
          notFound = false;
        } catch (e) {
          notFound = true;
        }
        const currentRequest = Object.assign({}, {
          url: req.url,
          method: req.method,
          headers: req.headers,
          filename,
          notFound
        });
        if (context.options && context.options.content && context.options.content.filter) {
          if (!context.options.content.filter(currentRequest)) {
            return goNext();
          }
        }
        const defaultTransform = (localRequest, fs) => new Promise((localResolve) => {
          if (notFound) {
            return localResolve(null);
          }
          fs.readFile(localRequest.filename, (err, content) => {
            if (err) {
              localResolve(null);
            } else {
              localResolve(content);
            }
          });
        });
        const optionTransform = (context.options && context.options.content) ? context.options.content.transform : null;
        return defaultTransform(currentRequest, context.fs)
          .then(content => ((!optionTransform) ? content : optionTransform(currentRequest, content, context.fs)))
          .then((content) => {
            if (content == null) {
              return Promise.reject();
            }
            content = handleRangeHeaders(content, req, res);
            let contentType = mime.getType(currentRequest.filename);

            // do not add charset to WebAssembly files, otherwise compileStreaming will fail in the client
            if (!/\.wasm$/.test(currentRequest.filename)) {
              contentType += '; charset=UTF-8';
            }

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', content.length);

            const { headers } = context.options;
            if (headers) {
              for (const name in headers) {
                if ({}.hasOwnProperty.call(headers, name)) {
                  res.setHeader(name, context.options.headers[name]);
                }
              }
            }
            // Express automatically sets the statusCode to 200, but not all servers do (Koa).
            res.statusCode = res.statusCode || 200;
            if (res.send) res.send(content);
            else res.end(content);
            resolve();
          })
          .catch(goNext);
      }
    }));
  };
};
