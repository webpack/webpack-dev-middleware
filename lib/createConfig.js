'use strict';

function createConfig(config, argv) {
  const options = config;

  if (argv.methods) {
    options.methods = argv.methods;
  }

  if (argv.headers) {
    options.headers = argv.headers;
  }

  if (argv.index) {
    options.index = argv.index;
  }

  if (argv.lazy) {
    options.lazy = argv.lazy;
  }

  if (argv.logLevel) {
    options.logLevel = argv.logLevel;
  }

  if (argv.logTime) {
    options.logTime = argv.logTime;
  }

  if (argv.serverSideRender) {
    options.serverSideRender = argv.serverSideRender;
  }

  if (argv.publicPath) {
    options.publicPath = argv.publicPath;
  }

  if (argv.watchOptions) {
    options.watchOptions = argv.watchOptions;
  }

  if (argv.writeToDisk) {
    options.writeToDisk = argv.writeToDisk;
  }

  return options;
}

module.exports = createConfig;
