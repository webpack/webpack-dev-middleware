import validateOptions from 'schema-utils';
import mime from 'mime-types';

import middleware from './middleware';
import setupHooks from './utils/setupHooks';
import setupLogger from './utils/setupLogger';
import setupWriteToDisk from './utils/setupWriteToDisk';
import setupOutputFileSystem from './utils/setupOutputFileSystem';
import getFilenameFromUrl from './utils/getFilenameFromUrl';
import ready from './utils/ready';
import schema from './options.json';

const noop = () => {};

const defaults = {
  stats: { colors: true, context: process.cwd() },
};

export default function wdm(compiler, opts = defaults) {
  validateOptions(schema, opts, 'webpack Dev Middleware');

  const options = Object.assign({}, defaults, opts);
  const context = {
    state: false,
    stats: null,
    callbacks: [],
    options,
    compiler,
    watching: null,
  };

  const { mimeTypes } = options;

  if (mimeTypes) {
    const { types } = mime;

    mime.types = { ...mimeTypes, ...types };
  }

  setupHooks(context);
  setupLogger(context);

  if (options.writeToDisk) {
    setupWriteToDisk(context);
  }

  setupOutputFileSystem(context);

  let watchOptions;

  if (Array.isArray(context.compiler.compilers)) {
    watchOptions = context.compiler.compilers.map(
      (compilerFromMultiCompileMode) =>
        compilerFromMultiCompileMode.options.watchOptions || {}
    );
  } else {
    watchOptions = context.compiler.options.watchOptions || {};
  }

  // Start watching
  context.watching = context.compiler.watch(watchOptions, (error) => {
    if (error) {
      context.logger.error(error);
    }
  });

  return Object.assign(middleware(context), {
    waitUntilValid(callback) {
      // eslint-disable-next-line no-param-reassign
      callback = callback || noop;

      ready(context, callback, {});
    },

    invalidate(callback) {
      // eslint-disable-next-line no-param-reassign
      callback = callback || noop;

      ready(context, callback, {});

      context.watching.invalidate();
    },

    close(callback) {
      // eslint-disable-next-line no-param-reassign
      callback = callback || noop;

      context.watching.close(callback);
    },

    getFilenameFromUrl: getFilenameFromUrl.bind(this, context),

    context,
  });
}
