import { validate } from "schema-utils";
import mime from "mime-types";

import middleware from "./middleware";
import getFilenameFromUrl from "./utils/getFilenameFromUrl";
import setupHooks from "./utils/setupHooks";
import setupWriteToDisk from "./utils/setupWriteToDisk";
import setupOutputFileSystem from "./utils/setupOutputFileSystem";
import ready from "./utils/ready";
import schema from "./options.json";

const noop = () => {};

/** @typedef {import("schema-utils/declarations/validate").Schema} Schema */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Configuration} Configuration */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {ReturnType<Compiler["getInfrastructureLogger"]>} Logger */
/** @typedef {import("http").IncomingMessage} IncomingMessage */
/** @typedef {import("http").ServerResponse} ServerResponse */
/** @typedef {import("express").Request} ExpressRequest */
/** @typedef {import("express").Response} ExpressResponse */

/**
 * @typedef {any} TODO
 */

// TODO fix me
/**
 * @typedef {IncomingMessage | ExpressRequest} Request
 */

/**
 * @typedef {(ServerResponse | ExpressResponse) & { locals?: { webpack?: { devMiddleware?: Context } } }} Response
 */

/**
 * @callback Next
 * @param {any} [err]
 * @return {void}
 */

/**
 * @typedef {NonNullable<Configuration["watchOptions"]>} WatchOptions
 */

/**
 * @typedef {Compiler["watching"]} Watching
 */

/**
 * @typedef {ReturnType<Compiler["watch"]>} MultiWatching
 */

/**
 * @typedef {Compiler["outputFileSystem"] & { createReadStream?: import("fs").createReadStream, statSync?: import("fs").statSync, lstat?: import("fs").lstat, readFileSync?: import("fs").readFileSync }} OutputFileSystem
 */

/**
 * @typedef {Object} Context
 * @property {boolean} state
 * @property {Stats | MultiStats | undefined} stats
 * @property {Function[]} callbacks
 * @property {Options} options
 * @property {Compiler | MultiCompiler} compiler
 * @property {Watching | MultiWatching} watching
 * @property {Logger} logger
 * @property {OutputFileSystem} outputFileSystem
 */

/**
 * @typedef {Record<string, number | string> | Array<{ key: string, value: number | string }> | ((req: Request, res: Response, context: Context) => Record<string, number | string>)} Headers
 */

// TODO test with memory-fs
/**
 * @typedef {Object} Options
 * @property {{[key: string]: string}} [mimeTypes]
 * @property {boolean | TODO} [writeToDisk]
 * @property {string} [methods]
 * @property {Headers} [headers]
 * @property {NonNullable<Configuration["output"]>["publicPath"]} [publicPath]
 * @property {Configuration["stats"]} [stats]
 * @property {boolean} [serverSideRender]
 * @property {OutputFileSystem} [outputFileSystem]
 * @property {boolean | string} [index]
 */

/**
 * @callback Middleware
 * @param {Request} req
 * @param {Response} res
 * @param {Next} next
 */

/**
 * @typedef {Object} AdditionalMethods
 * @property {TODO} getFilenameFromUrl
 * @property {TODO} waitUntilValid
 * @property {TODO} invalidate
 * @property {TODO} close
 * @property {Context} context
 */

/**
 * @typedef {Middleware & AdditionalMethods} API
 */

/**
 * @param {Compiler | MultiCompiler} compiler
 * @param {Options} [options]
 * @returns {API}
 */
export default function wdm(compiler, options = {}) {
  validate(/** @type {Schema} */ (schema), options, {
    name: "Dev Middleware",
    baseDataPath: "options",
  });

  const { mimeTypes } = options;

  if (mimeTypes) {
    const { types } = mime;

    // mimeTypes from user provided options should take priority
    // over existing, known types
    // @ts-ignore
    mime.types = { ...types, ...mimeTypes };
  }

  /**
   * @type {Context}
   */
  const context = {
    state: false,
    // eslint-disable-next-line no-undefined
    stats: undefined,
    callbacks: [],
    options,
    compiler,
    // @ts-ignore
    // eslint-disable-next-line no-undefined
    watching: undefined,
    logger: compiler.getInfrastructureLogger("webpack-dev-middleware"),
    // @ts-ignore
    // eslint-disable-next-line no-undefined
    outputFileSystem: undefined,
  };

  setupHooks(context);

  if (options.writeToDisk) {
    setupWriteToDisk(context);
  }

  setupOutputFileSystem(context);

  // Start watching
  if (/** @type {Compiler} */ (context.compiler).watching) {
    context.watching = /** @type {Compiler} */ (context.compiler).watching;
  } else {
    /**
     * @type {WatchOptions | WatchOptions[]}
     */
    let watchOptions;

    /**
     * @param {Error | undefined} error
     */
    const errorHandler = (error) => {
      if (error) {
        // TODO: improve that in future
        // For example - `writeToDisk` can throw an error and right now it is ends watching.
        // We can improve that and keep watching active, but it is require API on webpack side.
        // Let's implement that in webpack@5 because it is rare case.
        context.logger.error(error);
      }
    };

    if (
      Array.isArray(/** @type {MultiCompiler} */ (context.compiler).compilers)
    ) {
      watchOptions =
        /** @type {MultiCompiler} */
        (context.compiler).compilers.map(
          /**
           * @param {Compiler} childCompiler
           * @returns {WatchOptions}
           */
          (childCompiler) => childCompiler.options.watchOptions || {}
        );

      context.watching =
        /** @type {MultiWatching} */
        (
          context.compiler.watch(
            /** @type {WatchOptions}} */
            (watchOptions),
            errorHandler
          )
        );
    } else {
      watchOptions =
        /** @type {Compiler} */ (context.compiler).options.watchOptions || {};

      context.watching = /** @type {Watching} */ (
        context.compiler.watch(watchOptions, errorHandler)
      );
    }
  }

  const instance = /** @type {API} */ (middleware(context));

  // API
  /** @type {API} */
  (instance).getFilenameFromUrl =
    /**
     * @param {string} url
     * @returns {string|undefined}
     */
    (url) => getFilenameFromUrl(context, url);

  /** @type {API} */
  (instance).waitUntilValid = (callback = noop) => {
    ready(context, callback);
  };

  /** @type {API} */
  (instance).invalidate = (callback = noop) => {
    ready(context, callback);

    context.watching.invalidate();
  };

  /** @type {API} */
  (instance).close = (callback = noop) => {
    context.watching.close(callback);
  };

  /** @type {API} */
  (instance).context = context;

  return instance;
}
