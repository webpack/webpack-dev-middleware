import mime from 'mime';
import validateOptions from 'schema-utils';

import middleware from './middleware';
import setupHooks from './utils/setupHooks';
import setupRebuild from './utils/setupRebuild';
import setupLogger from './utils/setupLogger';
import setupWriteToDisk from './utils/setupWriteToDisk';
import setupOutputFileSystem from './utils/setupOutputFileSystem';
import getFilenameFromUrl from './utils/getFilenameFromUrl';
import ready from './utils/ready';
import schema from './options.json';

const noop = () => {};

const defaults = {
  stats: {
    colors: true,
    context: process.cwd(),
  },
  watchOptions: {
    aggregateTimeout: 200,
  },
  writeToDisk: false,
};

export default function wdm(compiler, opts = defaults) {
  validateOptions(schema, opts, 'webpack Dev Middleware');

  const options = Object.assign({}, defaults, opts);

  // defining custom MIME type
  if (options.mimeTypes) {
    const typeMap = options.mimeTypes.typeMap || options.mimeTypes;
    const force = Boolean(options.mimeTypes.force);

    mime.define(typeMap, force);
  }

  const context = {
    state: false,
    stats: null,
    callbacks: [],
    options,
    compiler,
    watching: null,
    forceRebuild: false,
  };

  setupHooks(context);
  setupRebuild(context);
  setupLogger(context);

  if (options.writeToDisk) {
    setupWriteToDisk(context);
  }

  setupOutputFileSystem(compiler, context);

  // start watching
  if (!options.lazy) {
    context.watching = compiler.watch(options.watchOptions, (error) => {
      if (error) {
        context.logger.error(error);
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

    context,

    getFilenameFromUrl: getFilenameFromUrl.bind(
      this,
      context.options.publicPath,
      context.compiler
    ),
  });
}
