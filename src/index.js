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
/** @typedef {import("fs").ReadStream} ReadStream */

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
 * @typedef {ReturnType<MultiCompiler["watch"]>} MultiWatching
 */

// TODO fix me after the next webpack release
/**
 * @typedef {Object & { createReadStream?: import("fs").createReadStream, statSync?: import("fs").statSync, lstat?: import("fs").lstat, readFileSync?: import("fs").readFileSync }} OutputFileSystem
 */

/** @typedef {ReturnType<Compiler["getInfrastructureLogger"]>} Logger */

/**
 * @callback Callback
 * @param {Stats | MultiStats} [stats]
 */

/**
 * @typedef {Object} ResponseData
 * @property {string | Buffer | ReadStream} data
 * @property {number} byteLength
 */

/**
 * @template {IncomingMessage} RequestInternal
 * @template {ServerResponse} ResponseInternal
 * @callback ModifyResponseData
 * @param {RequestInternal} req
 * @param {ResponseInternal} res
 * @param {string | Buffer | ReadStream} data
 * @param {number} byteLength
 * @return {ResponseData}
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
 * @property {Watching | MultiWatching | undefined} watching
 * @property {Logger} logger
 * @property {OutputFileSystem} outputFileSystem
 */

/**
 * @template {IncomingMessage} RequestInternal
 * @template {ServerResponse} ResponseInternal
 * @typedef {WithoutUndefined<Context<RequestInternal, ResponseInternal>, "watching">} FilledContext
 */

/** @typedef {Record<string, string | number> | Array<{ key: string, value: number | string }>} NormalizedHeaders */

/**
 * @template {IncomingMessage} RequestInternal
 * @template {ServerResponse} ResponseInternal
 * @typedef {NormalizedHeaders | ((req: RequestInternal, res: ResponseInternal, context: Context<RequestInternal, ResponseInternal>) =>  void | undefined | NormalizedHeaders) | undefined} Headers
 */

/**
 * @template {IncomingMessage} RequestInternal
 * @template {ServerResponse} ResponseInternal
 * @typedef {Object} Options
 * @property {{[key: string]: string}} [mimeTypes]
 * @property {string | undefined} [mimeTypeDefault]
 * @property {boolean | ((targetPath: string) => boolean)} [writeToDisk]
 * @property {string[]} [methods]
 * @property {Headers<RequestInternal, ResponseInternal>} [headers]
 * @property {NonNullable<Configuration["output"]>["publicPath"]} [publicPath]
 * @property {Configuration["stats"]} [stats]
 * @property {boolean} [serverSideRender]
 * @property {OutputFileSystem} [outputFileSystem]
 * @property {boolean | string} [index]
 * @property {ModifyResponseData<RequestInternal, ResponseInternal>} [modifyResponseData]
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

/** @typedef {import("./utils/getFilenameFromUrl").Extra} Extra */

/**
 * @callback GetFilenameFromUrl
 * @param {string} url
 * @param {Extra=} extra
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
 * @template T
 * @template {keyof T} K
 * @typedef {Omit<T, K> & Partial<T>} WithOptional
 */

/**
 * @template T
 * @template {keyof T} K
 * @typedef {T & { [P in K]: NonNullable<T[P]> }} WithoutUndefined
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
   * @type {WithOptional<Context<RequestInternal, ResponseInternal>, "watching" | "outputFileSystem">}
   */
  const context = {
    state: false,
    // eslint-disable-next-line no-undefined
    stats: undefined,
    callbacks: [],
    options,
    compiler,
    logger: compiler.getInfrastructureLogger("webpack-dev-middleware"),
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
      const compiler = /** @type {MultiCompiler} */ (context.compiler);
      const watchOptions = compiler.compilers.map(
        (childCompiler) => childCompiler.options.watchOptions || {},
      );

      context.watching = compiler.watch(watchOptions, errorHandler);
    } else {
      const compiler = /** @type {Compiler} */ (context.compiler);
      const watchOptions = compiler.options.watchOptions || {};

      context.watching = compiler.watch(watchOptions, errorHandler);
    }
  }

  const filledContext =
    /** @type {FilledContext<RequestInternal, ResponseInternal>} */
    (context);

  const instance =
    /** @type {API<RequestInternal, ResponseInternal>} */
    (middleware(filledContext));

  // API
  instance.getFilenameFromUrl = (url, extra) =>
    getFilenameFromUrl(filledContext, url, extra);

  instance.waitUntilValid = (callback = noop) => {
    ready(filledContext, callback);
  };

  instance.invalidate = (callback = noop) => {
    ready(filledContext, callback);

    filledContext.watching.invalidate();
  };

  instance.close = (callback = noop) => {
    filledContext.watching.close(callback);
  };

  instance.context = filledContext;

  return instance;
}

module.exports = wdm;
