'use strict';

const mime = require('mime');

const middleware = require('./lib/middleware');
const reporter = require('./lib/utils/reporter');
const {
  setupHooks,
  setupRebuild,
  setupLogger,
  setupWriteToDisk,
  setupOutputFileSystem,
  getFilenameFromUrl,
  ready,
} = require('./lib/utils');

const noop = () => {};

const defaults = {
  logLevel: 'info',
  logTime: false,
  logger: null,
  mimeTypes: null,
  reporter,
  stats: {
    colors: true,
    context: process.cwd(),
  },
  watchOptions: {
    aggregateTimeout: 200,
  },
  writeToDisk: false,
};

module.exports = function wdm(compiler, opts) {
  const options = Object.assign({}, defaults, opts);

  // defining custom MIME type
  if (options.mimeTypes) {
    const typeMap = options.mimeTypes.typeMap || options.mimeTypes;
    const force = Boolean(options.mimeTypes.force);

    mime.define(typeMap, force);
  }

  const context = {
    state: false,
    webpackStats: null,
    callbacks: [],
    options,
    compiler,
    watching: null,
    forceRebuild: false,
  };

  setupHooks(context);
  setupRebuild(context);
  setupLogger(context);

  // start watching
  if (!options.lazy) {
    context.watching = compiler.watch(options.watchOptions, (err) => {
      if (err) {
        context.log.error(err.stack || err);

        if (err.details) {
          context.log.error(err.details);
        }
      }
    });
  } else {
    if (typeof options.filename === 'string') {
      const filename = options.filename
        .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&') // eslint-disable-line no-useless-escape
        .replace(/\\\[[a-z]+\\\]/gi, '.+');

      options.filename = new RegExp(`^[/]{0,1}${filename}$`);
    }

    context.state = true;
  }

  if (options.writeToDisk) {
    setupWriteToDisk(context);
  }

  setupOutputFileSystem(compiler, context);

  return Object.assign(middleware(context), {
    close(callback) {
      // eslint-disable-next-line no-param-reassign
      callback = callback || noop;

      if (context.watching) {
        context.watching.close(callback);
      } else {
        callback();
      }
    },

    context,

    fileSystem: context.fs,

    getFilenameFromUrl: getFilenameFromUrl.bind(
      this,
      context.options.publicPath,
      context.compiler
    ),

    invalidate(callback) {
      // eslint-disable-next-line no-param-reassign
      callback = callback || noop;

      if (context.watching) {
        ready(context, callback, {});
        context.watching.invalidate();
      } else {
        callback();
      }
    },

    waitUntilValid(callback) {
      // eslint-disable-next-line no-param-reassign
      callback = callback || noop;

      ready(context, callback, {});
    },
  });
};
