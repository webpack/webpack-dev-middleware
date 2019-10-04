'use strict';

// eslint-disable-next-line consistent-return
function ready(context, fn, req) {
  if (context.state) {
    return fn(context.webpackStats);
  }

  context.log.info(`wait until bundle finished: ${req.url || fn.name}`);
  context.callbacks.push(fn);
}

module.exports = ready;
