'use strict';

const weblog = require('webpack-log');

function setupLogger(context) {
  if (context.options.logger) {
    // eslint-disable-next-line no-param-reassign
    context.log = context.options.logger;

    return;
  }

  // eslint-disable-next-line no-param-reassign
  context.log = weblog({
    level: context.options.logLevel || 'info',
    name: 'wdm',
    timestamp: context.options.logTime,
  });
}

module.exports = setupLogger;
