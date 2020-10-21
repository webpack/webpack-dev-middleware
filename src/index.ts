import { validate } from 'schema-utils';
import type webpack from 'webpack';
import mime from 'mime-types';

import middleware from './middleware';
import setupHooks from './utils/setupHooks';
import setupWriteToDisk from './utils/setupWriteToDisk';
import setupOutputFileSystem from './utils/setupOutputFileSystem';
import ready from './utils/ready';
import schema from './options.json';
import type { Schema } from 'schema-utils/declarations/validate';
import { isMultiCompiler } from './utils/isMultiCompiler';

const noop = () => undefined;

namespace webpackDevMiddleware {
  export type Middleware = import('./types').WebpackDevMiddleware;
  export type SingleMiddleware = import('./types').WebpackDevMiddlewareSingle;
  export type MultiMiddleware = import('./types').WebpackDevMiddlewareMulti;
  export type Options = import('./types').WebpackDevMiddlewareOptions;
  export type Context = import('./types').WebpackDevMiddlewareContext;
  export type SingleContext = import('./types').WebpackDevMiddlewareSingleContext;
  export type MultiContext = import('./types').WebpackDevMiddlewareMultiContext;
}

function webpackDevMiddleware(
  compiler: webpack.Compiler,
  options?: webpackDevMiddleware.Options
): webpackDevMiddleware.SingleMiddleware;
function webpackDevMiddleware(
  compiler: webpack.MultiCompiler,
  options?: webpackDevMiddleware.Options
): webpackDevMiddleware.MultiMiddleware;
function webpackDevMiddleware(
  compiler: webpack.Compiler | webpack.MultiCompiler,
  options?: webpackDevMiddleware.Options
): webpackDevMiddleware.Middleware;
function webpackDevMiddleware(
  compiler: webpack.Compiler | webpack.MultiCompiler,
  options: webpackDevMiddleware.Options = {}
):
  | webpackDevMiddleware.Middleware
  | webpackDevMiddleware.SingleMiddleware
  | webpackDevMiddleware.MultiMiddleware {
  validate(schema as Schema, options, {
    name: 'Dev Middleware',
    baseDataPath: 'options',
  });

  const { mimeTypes } = options;

  if (mimeTypes) {
    Object.assign(mime.types, mimeTypes);
  }

  const context: webpackDevMiddleware.Context = {
    state: false,
    stats: null,
    callbacks: [],
    options,
    compiler,
    watching: null,
    logger: compiler.getInfrastructureLogger('webpack-dev-middleware'),
    outputFileSystem: undefined!,
  };

  setupHooks(context);

  if (options.writeToDisk) {
    setupWriteToDisk(context);
  }

  setupOutputFileSystem(context);

  type WebpackWatchOptions = webpack.Compiler['options']['watchOptions'];

  let watchOptions: WebpackWatchOptions | WebpackWatchOptions[];

  if (isMultiCompiler(context.compiler)) {
    watchOptions = context.compiler.compilers.map(
      (childCompiler) => childCompiler.options.watchOptions || {}
    );
  } else {
    watchOptions = context.compiler.options.watchOptions || {};
  }

  // Start watching
  context.watching = context.compiler.watch(watchOptions, (error?: Error) => {
    if (error) {
      // TODO: improve that in future
      // For example - `writeToDisk` can throw an error and right now it is ends watching.
      // We can improve that and keep watching active, but it is require API on webpack side.
      // Let's implement that in webpack@5 because it is rare case.
      context.logger.error(error);
    }
  });

  const devMiddleware = middleware(context) as webpackDevMiddleware.Middleware;
  devMiddleware.context = context;
  devMiddleware.waitUntilValid = (callback = noop) => {
    ready(context, callback);
  };
  devMiddleware.invalidate = (callback = noop) => {
    ready(context, callback);
    context.watching!.invalidate();
  };
  devMiddleware.close = (callback = noop) => {
    context.watching!.close(callback);
  };

  return devMiddleware;
}

export default webpackDevMiddleware;
