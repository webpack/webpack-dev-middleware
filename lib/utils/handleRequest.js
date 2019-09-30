'use strict';

const ready = require('./ready');

const HASH_REGEXP = /[0-9a-f]{10,}/;

function handleRequest(context, filename, processRequest, req) {
  // in lazy mode, rebuild on bundle request
  if (
    context.options.lazy &&
    (!context.options.filename || context.options.filename.test(filename))
  ) {
    context.rebuild();
  }

  if (HASH_REGEXP.test(filename)) {
    try {
      if (context.fs.statSync(filename).isFile()) {
        processRequest();
        return;
      }
    } catch (e) {
      // eslint-disable-line
    }
  }

  ready(context, processRequest, req);
}

module.exports = handleRequest;
