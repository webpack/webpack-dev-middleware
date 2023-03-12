const { validate } = require("schema-utils");
const mime = require("mime-types");

const middleware = require("./middleware");
const getFilenameFromUrl = require("./utils/getFilenameFromUrl");
const setupHooks = require("./utils/setupHooks");
const setupWriteToDisk = require("./utils/setupWriteToDisk");
const setupOutputFileSystem = require("./utils/setupOutputFileSystem");
const ready = require("./utils/ready");
const schema = require("./options.json");

const noop = () => {};

/** @typedef {import("schema-utils/declarations/validate").Schema} Schema */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Configuration} Configuration */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */

/**
 * @typedef {Object} ExtendedServerResponse
 * @property {{ webpack?: { devMiddleware?: Context<IncomingMessage, ServerResponse> } }} [locals]
 */

/** @typedef {import("http").IncomingMessage} IncomingMessage */
/** @typedef {import("http").ServerResponse & ExtendedServerResponse} ServerResponse */

/**
 * @callback NextFunction
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

/** @typedef {ReturnType<Compiler["getInfrastructureLogger"]>} Logger */

/**
 * @callback Callback
 * @param {Stats | MultiStats} [stats]
 */

/**
 * @template {IncomingMessage} RequestInternal
 * @template {ServerResponse} ResponseInternal
 * @typedef {Object} Context
 * @property {boolean} state
 * @property {Stats | MultiStats | undefined} stats
 * @property {Callback[]} callbacks
 * @property {Options<RequestInternal, ResponseInternal>} options
 * @property {Compiler | MultiCompiler} compiler
 * @property {Watching | MultiWatching} watching
 * @property {Logger} logger
 * @property {OutputFileSystem} outputFileSystem
 */

/**
 * @template {IncomingMessage} RequestInternal
 * @template {ServerResponse} ResponseInternal
 * @typedef {Record<string, string | number> | Array<{ key: string, value: number | string }> | ((req: RequestInternal, res: ResponseInternal, context: Context<RequestInternal, ResponseInternal>) =>  void | undefined | Record<string, string | number>) | undefined} Headers
 */

/**
 * @template {IncomingMessage} RequestInternal
 * @template {ServerResponse} ResponseInternal
 * @typedef {Object} Options
 * @property {{[key: string]: string}} [mimeTypes]
 * @property {boolean | ((targetPath: string) => boolean)} [writeToDisk]
 * @property {string} [methods]
 * @property {Headers<RequestInternal, ResponseInternal>} [headers]
 * @property {NonNullable<Configuration["output"]>["publicPath"]} [publicPath]
 * @property {Configuration["stats"]} [stats]
 * @property {boolean} [serverSideRender]
 * @property {OutputFileSystem} [outputFileSystem]
 * @property {boolean | string} [index]
 */

/**
 * @template {IncomingMessage} RequestInternal
 * @template {ServerResponse} ResponseInternal
 * @callback Middleware
 * @param {RequestInternal} req
 * @param {ResponseInternal} res
 * @param {NextFunction} next
 * @return {Promise<void>}
 */

/**
 * @callback GetFilenameFromUrl
 * @param {string} url
 * @returns {string | undefined}
 */

/**
 * @callback WaitUntilValid
 * @param {Callback} callback
 */

/**
 * @callback Invalidate
 * @param {Callback} callback
 */

/**
 * @callback Close
 * @param {(err: Error | null | undefined) => void} callback
 */

/**
 * @template {IncomingMessage} RequestInternal
 * @template {ServerResponse} ResponseInternal
 * @typedef {Object} AdditionalMethods
 * @property {GetFilenameFromUrl} getFilenameFromUrl
 * @property {WaitUntilValid} waitUntilValid
 * @property {Invalidate} invalidate
 * @property {Close} close
 * @property {Context<RequestInternal, ResponseInternal>} context
 */

/**
 * @template {IncomingMessage} RequestInternal
 * @template {ServerResponse} ResponseInternal
 * @typedef {Middleware<RequestInternal, ResponseInternal> & AdditionalMethods<RequestInternal, ResponseInternal>} API
 */

/**
 * @template {IncomingMessage} RequestInternal
 * @template {ServerResponse} ResponseInternal
 * @param {Compiler | MultiCompiler} compiler
 * @param {Options<RequestInternal, ResponseInternal>} [options]
 * @returns {API<RequestInternal, ResponseInternal>}
 */
function wdm(compiler, options = {}) {
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
   * @type {Context<RequestInternal, ResponseInternal>}
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
     * @param {Error | null | undefined} error
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

  const instance = /** @type {API<RequestInternal, ResponseInternal>} */ (
    middleware(context)
  );

  // API
  /** @type {API<RequestInternal, ResponseInternal>} */
  (instance).getFilenameFromUrl =
    /**
     * @param {string} url
     * @returns {string|undefined}
     */
    (url) => getFilenameFromUrl(context, url);

  /** @type {API<RequestInternal, ResponseInternal>} */
  (instance).waitUntilValid = (callback = noop) => {
    ready(context, callback);
  };

  /** @type {API<RequestInternal, ResponseInternal>} */
  (instance).invalidate = (callback = noop) => {
    ready(context, callback);

    context.watching.invalidate();
  };

  /** @type {API<RequestInternal, ResponseInternal>} */
  (instance).close = (callback = noop) => {
    context.watching.close(callback);
  };

  /** @type {API<RequestInternal, ResponseInternal>} */
  (instance).context = context;

  return instance;
}

module.exports = wdm;
