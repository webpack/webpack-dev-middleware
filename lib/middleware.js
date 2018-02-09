'use strict';

const mime = require('mime');
const detectContentType = require('detect-content-type');
const urlJoin = require('url-join');
const { getFilenameFromUrl, handleRangeHeaders, handleRequest, ready } = require('./util');

module.exports = function wrapper(context) {
  return function middleware(req, res, next) {
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

    if (req.method !== 'GET') {
      return goNext();
    }

    let filename = getFilenameFromUrl(context.options.publicPath, context.compiler, req.url);

    if (filename === false) {
      return goNext();
    }

    return new Promise(((resolve) => {
      handleRequest(context, filename, processRequest, req);
      function processRequest() {
        try {
          let stat = context.fs.statSync(filename);
          if (!stat.isFile()) {
            if (stat.isDirectory()) {
              let { index } = context.options;

              if (index === undefined || index === true) {
                index = 'index.html';
              } else if (!index) {
              // TODO throw a proper error
                throw new Error('next');
              }

              filename = urlJoin(filename, index);
              stat = context.fs.statSync(filename);
              if (!stat.isFile()) {
              // TODO throw a proper error
                throw new Error('next');
              }
            } else {
            // TODO throw a proper error
              throw new Error('next');
            }
          }
        } catch (e) {
          return resolve(goNext());
        }

        // server content
        let content = context.fs.readFileSync(filename);

        let contentType = mime.getType(filename);
        if (contentType !== null) {
          // do not add charset to WebAssembly files, otherwise compileStreaming will fail in the client
          if (!/\.wasm$/.test(filename)) {
            contentType += '; charset=UTF-8';
          }
        } else {
          // Perform MIME sniffing if contentType is null
          contentType = detectContentType(content);
        }

        res.setHeader('Content-Type', contentType);

        content = handleRangeHeaders(content, req, res);
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
      }
    }));
  };
};
