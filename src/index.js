const fs = require("node:fs");
const path = require("node:path");
const memfs = require("memfs");
const mime = require("mime-types");

const middleware = require("./middleware");

const noop = () => {};

/** @typedef {import("schema-utils/declarations/validate").Schema} Schema */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Configuration} Configuration */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("fs").ReadStream} ReadStream */
/** @typedef {import("./middleware").Extra} Extra */

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */
// eslint-disable-next-line jsdoc/reject-function-type
/** @typedef {Function} EXPECTED_FUNCTION */

/**
 * @typedef {object} ExtendedServerResponse
 * @property {{ webpack?: { devMiddleware?: Context<IncomingMessage, ServerResponse> } }=} locals locals
 */

/** @typedef {import("http").IncomingMessage} IncomingMessage */
/** @typedef {import("http").ServerResponse & ExtendedServerResponse} ServerResponse */

/**
 * @callback NextFunction
 * @param {EXPECTED_ANY=} err error
 * @returns {void}
 */

/** @typedef {NonNullable<Configuration["watchOptions"]>} WatchOptions */
/** @typedef {Compiler["watching"]} Watching */
/** @typedef {ReturnType<MultiCompiler["watch"]>} MultiWatching */
/** @typedef {import("webpack").OutputFileSystem & { createReadStream?: import("fs").createReadStream, statSync: import("fs").statSync, readFileSync: import("fs").readFileSync }} OutputFileSystem */
/** @typedef {ReturnType<Compiler["getInfrastructureLogger"]>} Logger */

/**
 * @callback Callback
 * @param {(Stats | MultiStats)=} stats
 */

/**
 * @typedef {object} ResponseData
 * @property {Buffer | ReadStream} data data
 * @property {number} byteLength byte length
 */

/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @callback ModifyResponseData
 * @param {RequestInternal} req req
 * @param {ResponseInternal} res res
 * @param {Buffer | ReadStream} data data
 * @param {number} byteLength byte length
 * @returns {ResponseData}
 */

/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @typedef {object} Context
 * @property {boolean} state state
 * @property {Stats | MultiStats | undefined} stats stats
 * @property {Callback[]} callbacks callbacks
 * @property {Options<RequestInternal, ResponseInternal>} options options
 * @property {Compiler | MultiCompiler} compiler compiler
 * @property {Watching | MultiWatching} watching watching
 * @property {Logger} logger logger
 * @property {OutputFileSystem} outputFileSystem output file system
 */

/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @typedef {WithoutUndefined<Context<RequestInternal, ResponseInternal>, "watching">} FilledContext
 */

/** @typedef {Record<string, string | number> | { key: string, value: number | string }[]} NormalizedHeaders */

/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @typedef {NormalizedHeaders | ((req: RequestInternal, res: ResponseInternal, context: Context<RequestInternal, ResponseInternal>) => void | undefined | NormalizedHeaders) | undefined} Headers
 */

/**
 * @template {IncomingMessage} [RequestInternal = IncomingMessage]
 * @template {ServerResponse} [ResponseInternal = ServerResponse]
 * @typedef {object} Options
 * @property {{ [key: string]: string }=} mimeTypes mime types
 * @property {(string | undefined)=} mimeTypeDefault mime type default
 * @property {(boolean | ((targetPath: string) => boolean))=} writeToDisk write to disk
 * @property {string[]=} methods methods
 * @property {Headers<RequestInternal, ResponseInternal>=} headers headers
 * @property {NonNullable<Configuration["output"]>["publicPath"]=} publicPath public path
 * @property {Configuration["stats"]=} stats stats
 * @property {boolean=} serverSideRender is server side render
 * @property {OutputFileSystem=} outputFileSystem output file system
 * @property {(boolean | string)=} index index
 * @property {ModifyResponseData<RequestInternal, ResponseInternal>=} modifyResponseData modify response data
 * @property {"weak" | "strong"=} etag options to generate etag header
 * @property {boolean=} lastModified options to generate last modified header
 * @property {(boolean | number | string | { maxAge?: number, immutable?: boolean })=} cacheControl options to generate cache headers
 * @property {boolean=} cacheImmutable is cache immutable
 * @property {boolean=} forwardError forward error to next middleware
 */

/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @callback Middleware
 * @param {RequestInternal} req request
 * @param {ResponseInternal} res response
 * @param {NextFunction} next next function
 * @returns {Promise<void>}
 */

/**
 * @callback GetFilenameFromUrl
 * @param {string} url request URL
 * @returns {{ filename: string, extra: Extra } | undefined} a filename with additional information, or `undefined` if nothing is found
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
 * @typedef {object} AdditionalMethods
 * @property {GetFilenameFromUrl} getFilenameFromUrl get filename from url
 * @property {WaitUntilValid} waitUntilValid wait until valid
 * @property {Invalidate} invalidate invalidate
 * @property {Close} close close
 * @property {Context<RequestInternal, ResponseInternal>} context context
 */

/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
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
 * @param {Compiler | MultiCompiler} compiler compiler
 * @returns {compiler is MultiCompiler} true when is multi compiler, otherwise false
 */
function isMultipleCompiler(compiler) {
  return (
    typeof (/** @type {MultiCompiler} */ (compiler).compilers) !== "undefined"
  );
}

/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @param {Compiler | MultiCompiler} compiler compiler
 * @param {Options<RequestInternal, ResponseInternal>} options options
 */
const internalValidate = (compiler, options) => {
  const schema = require("./options.json");

  const firstCompiler = /** @type {Compiler & { validate: EXPECTED_ANY }} */ (
    isMultipleCompiler(compiler) ? compiler.compilers[0] : compiler
  );

  if (typeof firstCompiler.validate === "function") {
    firstCompiler.validate(schema, options, {
      name: "Dev Middleware",
      baseDataPath: "options",
    });
    return;
  }

  // TODO in the next major release bump minimum supported webpack version and remove it in favor of `compiler.validate` (above)
  const { validate } = require("schema-utils");

  validate(/** @type {Schema} */ (schema), options, {
    name: "Dev Middleware",
    baseDataPath: "options",
  });
};

/** @typedef {Configuration["stats"]} StatsOptions */
/** @typedef {{ children: Configuration["stats"][] }} MultiStatsOptions */
/** @typedef {Exclude<Configuration["stats"], boolean | string | undefined>} StatsObjectOptions */

/**
 * @param {StatsOptions} statsOptions stats options
 * @returns {StatsObjectOptions} object stats options
 */
function normalizeStatsOptions(statsOptions) {
  if (typeof statsOptions === "undefined") {
    statsOptions = { preset: "normal" };
  } else if (typeof statsOptions === "boolean") {
    statsOptions = statsOptions ? { preset: "normal" } : { preset: "none" };
  } else if (typeof statsOptions === "string") {
    statsOptions = { preset: statsOptions };
  }

  return statsOptions;
}

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Stats | MultiStats} stats stats
 * @param {WithOptional<Context<Request, Response>, "watching" | "outputFileSystem">} context context
 */
function printStats(stats, context) {
  const { compiler, logger, options } = context;

  logger.log("Compilation finished");

  const isMultiCompilerMode = isMultipleCompiler(compiler);

  /**
   * @type {StatsOptions | MultiStatsOptions | undefined}
   */
  let statsOptions;

  if (typeof options.stats !== "undefined") {
    statsOptions = isMultiCompilerMode
      ? {
          children:
            /** @type {MultiCompiler} */
            (compiler).compilers.map(() => options.stats),
        }
      : options.stats;
  } else {
    statsOptions = isMultiCompilerMode
      ? {
          children:
            /** @type {MultiCompiler} */
            (compiler).compilers.map((child) => child.options.stats),
        }
      : /** @type {Compiler} */ (compiler).options.stats;
  }

  if (isMultiCompilerMode) {
    /** @type {MultiStatsOptions} */
    (statsOptions).children =
      /** @type {MultiStatsOptions} */
      (statsOptions).children.map(
        /**
         * @param {StatsOptions} childStatsOptions child stats options
         * @returns {StatsObjectOptions} object child stats options
         */
        (childStatsOptions) => {
          childStatsOptions = normalizeStatsOptions(childStatsOptions);

          if (typeof childStatsOptions.colors === "undefined") {
            const [firstCompiler] =
              /** @type {MultiCompiler} */
              (compiler).compilers;

            childStatsOptions.colors =
              firstCompiler.webpack.cli.isColorSupported();
          }

          return childStatsOptions;
        },
      );
  } else {
    statsOptions = normalizeStatsOptions(
      /** @type {StatsOptions} */ (statsOptions),
    );

    if (typeof statsOptions.colors === "undefined") {
      const { compiler } = /** @type {{ compiler: Compiler }} */ (context);
      statsOptions.colors = compiler.webpack.cli.isColorSupported();
    }
  }

  const printedStats = stats.toString(
    /** @type {StatsObjectOptions} */
    (statsOptions),
  );

  // Avoid extra empty line when `stats: 'none'`
  if (printedStats) {
    // eslint-disable-next-line no-console
    console.log(printedStats);
  }
}

const PLUGIN_NAME = "DevMiddleware";

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Compiler} compiler compiler
 * @param {WithOptional<Context<Request, Response>, "watching" | "outputFileSystem">} context context
 */
function hookForWriteToDisk(compiler, context) {
  compiler.hooks.emit.tap(PLUGIN_NAME, () => {
    // @ts-expect-error
    if (compiler.hasWebpackDevMiddlewareAssetEmittedCallback) {
      return;
    }

    compiler.hooks.assetEmitted.tapAsync(
      PLUGIN_NAME,
      (file, info, callback) => {
        const { targetPath, content } = info;
        const { writeToDisk: filter } = context.options;
        const allowWrite =
          filter && typeof filter === "function" ? filter(targetPath) : true;

        if (!allowWrite) {
          return callback();
        }

        const dir = path.dirname(targetPath);
        const name = compiler.options.name
          ? `Child "${compiler.options.name}": `
          : "";

        return fs.mkdir(dir, { recursive: true }, (mkdirError) => {
          if (mkdirError) {
            context.logger.error(
              `${name}Unable to write "${dir}" directory to disk:\n${mkdirError}`,
            );

            return callback(mkdirError);
          }

          return fs.writeFile(targetPath, content, (writeFileError) => {
            if (writeFileError) {
              context.logger.error(
                `${name}Unable to write "${targetPath}" asset to disk:\n${writeFileError}`,
              );

              return callback(writeFileError);
            }

            context.logger.log(`${name}Asset written to disk: "${targetPath}"`);

            return callback();
          });
        });
      },
    );

    // @ts-expect-error
    compiler.hasWebpackDevMiddlewareAssetEmittedCallback = true;
  });
}

/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @param {Compiler | MultiCompiler} compiler compiler
 * @param {Options<RequestInternal, ResponseInternal>=} options options
 * @param {boolean} isPlugin true when will use as a plugin, otherwise false
 * @returns {API<RequestInternal, ResponseInternal>} webpack dev middleware
 */
function wdm(compiler, options = {}, isPlugin = false) {
  internalValidate(compiler, options);

  const { mimeTypes } = options;

  if (mimeTypes) {
    const { types } = mime;

    // mimeTypes from user provided options should take priority
    // over existing, known types
    // @ts-expect-error
    mime.types = { ...types, ...mimeTypes };
  }

  /**
   * @type {WithOptional<Context<RequestInternal, ResponseInternal>, "watching" | "outputFileSystem">}
   */
  const context = {
    state: false,
    stats: undefined,
    callbacks: [],
    options,
    compiler,
    logger: compiler.getInfrastructureLogger("webpack-dev-middleware"),
  };

  // Adding hooks
  /**
   * @returns {void}
   */
  const invalid = () => {
    if (context.state) {
      context.logger.log("Compilation starting...");
    }

    // We are now in invalid state
    context.state = false;
    context.stats = undefined;
  };
  /**
   * @param {Stats | MultiStats} stats stats
   * @returns {void}
   */
  const done = (stats) => {
    // We are now on valid state

    context.state = true;
    context.stats = stats;

    // Do the stuff in nextTick, because bundle may be invalidated if a change happened while compiling
    process.nextTick(() => {
      const { state, callbacks } = context;

      // Check if still in valid state
      if (!state) {
        return;
      }

      // For plugin support we should print nothing, because webpack/webpack-cli/webpack-dev-server will print them on using `stats.toString()`
      if (!isPlugin) {
        printStats(stats, context);
      }

      context.callbacks = [];

      // Execute callback that are delayed
      for (const callback of callbacks) {
        callback(stats);
      }
    });
  };

  compiler.hooks.watchRun.tap(PLUGIN_NAME, invalid);
  compiler.hooks.invalid.tap(PLUGIN_NAME, invalid);
  compiler.hooks.done.tap(PLUGIN_NAME, done);

  const compilersToModify = isMultipleCompiler(compiler)
    ? compiler.compilers.filter((item) => item.options.devServer !== false)
    : [compiler];

  if (typeof options.writeToDisk === "function") {
    for (const compiler of compilersToModify) {
      hookForWriteToDisk(compiler, context);
    }
  }

  // Modify output file system
  let outputFileSystem;

  if (context.options.outputFileSystem) {
    const { outputFileSystem: outputFileSystemFromOptions } = context.options;

    outputFileSystem = outputFileSystemFromOptions;
  }
  // Don't use `memfs` when developer wants to write everything to a disk, because it doesn't make sense.
  else if (context.options.writeToDisk !== true) {
    outputFileSystem = memfs.createFsFromVolume(new memfs.Volume());
  } else if (isMultipleCompiler(compiler)) {
    // TODO refactor me, when true we should not do something, we already have the right output file system
    // Prefer compiler with `devServer` option or fallback on the first
    const [foundCompiler] = compilersToModify;

    ({ outputFileSystem } = foundCompiler || compiler.compilers[0]);
  } else {
    ({ outputFileSystem } = context.compiler);
  }

  context.outputFileSystem = /** @type {OutputFileSystem} */ (outputFileSystem);

  for (const compiler of compilersToModify) {
    // @ts-expect-error wrong ts types
    compiler.outputFileSystem = outputFileSystem;
  }

  // Start watching, but only for standalone usage, for plugin usage stats will be printed by external code, for example - webpack-cli
  if (!isPlugin) {
    /**
     * @param {Error | null} err err
     */
    const errorHandler = (err) => {
      if (err) {
        // For example - `writeToDisk` can throw an error and right now it is ends watching.
        // We can improve that and keep watching active, but it is require API on webpack side.
        // Let's implement that in webpack@5 because it is rare case.
        context.logger.error(err);
      }
    };

    if (isMultipleCompiler(compiler)) {
      // TODO improve on webpack side - add an option `watching(s)` for MultiCompiler
      context.watching = compiler.watch(
        compiler.compilers.map(
          (compiler) => compiler.options.watchOptions || {},
        ),
        errorHandler,
      );
    } else if (compiler.watching) {
      context.watching = compiler.watching;
    } else {
      context.watching = compiler.watch(
        compiler.options.watchOptions || {},
        errorHandler,
      );
    }
  }

  const filledContext =
    /** @type {FilledContext<RequestInternal, ResponseInternal>} */
    (context);

  const instance =
    /** @type {API<RequestInternal, ResponseInternal>} */
    (middleware(filledContext));

  // API
  instance.getFilenameFromUrl = (url) =>
    middleware.getFilenameFromUrl(filledContext, url);

  instance.waitUntilValid = (callback = noop) => {
    middleware.ready(filledContext, callback);
  };

  instance.invalidate = (callback = noop) => {
    middleware.ready(filledContext, callback);

    filledContext.watching.invalidate();
  };

  instance.close = (callback = noop) => {
    filledContext.watching.close(callback);
  };

  instance.context = filledContext;

  return instance;
}

/**
 * @template S
 * @template O
 * @typedef {object} HapiPluginBase
 * @property {(server: S, options: O) => void | Promise<void>} register register
 */

/**
 * @template S
 * @template O
 * @typedef {HapiPluginBase<S, O> & { pkg: { name: string }, multiple: boolean }} HapiPlugin
 */

/**
 * @typedef {Options & { compiler: Compiler | MultiCompiler }} HapiOptions
 */

/**
 * @template HapiServer
 * @template {HapiOptions} HapiOptionsInternal
 * @param {boolean=} usePlugin true when need to use as a plugin, otherwise false
 * @returns {HapiPlugin<HapiServer, HapiOptionsInternal>} hapi wrapper
 */
function hapiWrapper(usePlugin = false) {
  return {
    pkg: {
      name: "webpack-dev-middleware",
    },
    // Allow to have multiple middleware
    multiple: true,
    register(server, options) {
      const { compiler, ...rest } = options;

      if (!compiler) {
        throw new Error("The compiler options is required.");
      }

      const devMiddleware = wdm(compiler, rest, usePlugin);

      // @ts-expect-error
      if (!server.decorations.server.includes("webpackDevMiddleware")) {
        // @ts-expect-error
        server.decorate("server", "webpackDevMiddleware", devMiddleware);
      }

      // @ts-expect-error
      // eslint-disable-next-line id-length
      server.ext("onRequest", (request, h) =>
        new Promise((resolve, reject) => {
          let isFinished = false;

          /**
           * @param {(string | Buffer)=} data
           */

          request.raw.res.send = (data) => {
            isFinished = true;
            request.raw.res.end(data);
          };

          /**
           * @param {(string | Buffer)=} data
           */

          request.raw.res.finish = (data) => {
            isFinished = true;
            request.raw.res.end(data);
          };

          devMiddleware(request.raw.req, request.raw.res, (error) => {
            if (error) {
              reject(error);
              return;
            }

            if (!isFinished) {
              resolve(request);
            }
          });
        })
          .then(() => h.continue)
          .catch((error) => {
            throw error;
          }),
      );
    },
  };
}

wdm.hapiWrapper = hapiWrapper;

/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @param {Compiler | MultiCompiler} compiler compiler
 * @param {Options<RequestInternal, ResponseInternal>=} options options
 * @param {boolean=} usePlugin whether to use as webpack plugin
 * @returns {(ctx: EXPECTED_ANY, next: EXPECTED_FUNCTION) => Promise<void> | void} kow wrapper
 */
function koaWrapper(compiler, options = {}, usePlugin = false) {
  const devMiddleware = wdm(compiler, options, usePlugin);

  /**
   * @param {{ req: RequestInternal, res: ResponseInternal & import("./utils").ExpectedServerResponse, status: number, body: string | Buffer | import("fs").ReadStream | { message: string }, state: object }} ctx context
   * @param {EXPECTED_FUNCTION} next next
   * @returns {Promise<void>}
   */
  async function webpackDevMiddleware(ctx, next) {
    const { req, res } = ctx;

    res.locals = ctx.state;

    let { status } = ctx;

    /**
     * @returns {number} code
     */
    res.getStatusCode = () => status;

    /**
     * @param {number} statusCode status code
     */
    res.setStatusCode = (statusCode) => {
      status = statusCode;

      ctx.status = statusCode;
    };

    let isFinished = false;
    let needNext = false;

    try {
      await new Promise(
        /**
         * @param {(value: void) => void} resolve resolve
         * @param {(reason?: Error) => void} reject reject
         */
        (resolve, reject) => {
          /**
           * @param {import("fs").ReadStream} stream readable stream
           */
          res.stream = (stream) => {
            let resolved = false;

            /**
             * @param {Error=} err error
             */
            const onEvent = (err) => {
              if (resolved) return;
              resolved = true;

              stream.removeListener("error", onEvent);
              stream.removeListener("readable", onEvent);

              if (err) {
                reject(err);
                return;
              }

              ctx.body = stream;
              isFinished = true;
              resolve();
            };

            stream.once("error", onEvent);
            stream.once("readable", onEvent);
            // Empty stream
            stream.once("end", onEvent);
          };
          /**
           * @param {string | Buffer} data data
           */
          res.send = (data) => {
            ctx.body = data;

            isFinished = true;
            resolve();
          };

          /**
           * @param {(string | Buffer)=} data data
           */
          res.finish = (data) => {
            ctx.status = status;
            res.end(data);

            isFinished = true;
            resolve();
          };

          devMiddleware(req, res, (err) => {
            if (err) {
              reject(err);
              return;
            }

            needNext = true;

            if (!isFinished) {
              resolve();
            }
          });
        },
      );
    } catch (err) {
      if (options?.forwardError) {
        await next();

        // need the return for prevent to execute the code below and override the status and body set by user in the next middleware
        return;
      }

      ctx.status =
        /** @type {Error & { statusCode: number }} */ (err).statusCode ||
        /** @type {Error & { status: number }} */ (err).status ||
        500;

      ctx.body = {
        message: /** @type {Error} */ (err).message,
      };
    }

    if (needNext) {
      await next();
    }
  }

  webpackDevMiddleware.devMiddleware = devMiddleware;

  return webpackDevMiddleware;
}

wdm.koaWrapper = koaWrapper;

/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @param {Compiler | MultiCompiler} compiler compiler
 * @param {Options<RequestInternal, ResponseInternal>=} options options
 * @param {boolean=} usePlugin true when need to use as a plugin, otherwise false
 * @returns {(ctx: EXPECTED_ANY, next: EXPECTED_FUNCTION) => Promise<void> | void} hono wrapper
 */
function honoWrapper(compiler, options = {}, usePlugin = false) {
  const devMiddleware = wdm(compiler, options, usePlugin);

  /**
   * @param {{ env: EXPECTED_ANY, body: EXPECTED_ANY, json: EXPECTED_ANY, status: EXPECTED_ANY, set: EXPECTED_ANY, req: RequestInternal & import("./utils").ExpectedIncomingMessage & { header: (name: string) => string }, res: ResponseInternal & import("./utils").ExpectedServerResponse & { headers: EXPECTED_ANY, status: EXPECTED_ANY } }} context context
   * @param {EXPECTED_FUNCTION} next next function
   * @returns {Promise<void>}
   */
  async function webpackDevMiddleware(context, next) {
    const { req, res } = context;

    context.set("webpack", { devMiddleware: devMiddleware.context });

    /**
     * @returns {string | undefined} method
     */
    req.getMethod = () => context.req.method;

    /**
     * @param {string} name name
     * @returns {string | string[] | undefined} header value
     */
    req.getHeader = (name) => context.req.header(name);

    /**
     * @returns {string | undefined} URL
     */
    req.getURL = () => context.req.url;

    let { status } = context.res;

    /**
     * @returns {number} code code
     */
    res.getStatusCode = () => status;

    /**
     * @param {number} code code
     */
    res.setStatusCode = (code) => {
      status = code;
    };

    /**
     * @param {string} name header name
     * @returns {string | string[] | undefined} header
     */
    res.getHeader = (name) => context.res.headers.get(name);

    /**
     * @param {string} name header name
     * @param {string | number | Readonly<string[]>} value value
     * @returns {ResponseInternal & import("./utils").ExpectedServerResponse & { headers: EXPECTED_ANY, status: EXPECTED_ANY }} response
     */
    res.setHeader = (name, value) => {
      context.res.headers.append(name, value);
      return context.res;
    };

    /**
     * @param {string} name header name
     */
    res.removeHeader = (name) => {
      context.res.headers.delete(name);
    };

    /**
     * @returns {string[]} response headers
     */
    res.getResponseHeaders = () => [...context.res.headers.keys()];

    /**
     * @returns {ServerResponse} server response
     */
    res.getOutgoing = () => context.env.outgoing;

    res.setState = () => {
      // Do nothing, because we set it before
    };

    res.getHeadersSent = () => context.env.outgoing.headersSent;

    let body;
    let isFinished = false;

    try {
      await new Promise(
        /**
         * @param {(value: void) => void} resolve resolve
         * @param {(reason?: Error) => void} reject reject
         */
        (resolve, reject) => {
          /**
           * @param {import("fs").ReadStream} stream readable stream
           */
          res.stream = (stream) => {
            let isResolved = false;

            /**
             * @param {Error=} err err
             */
            const onEvent = (err) => {
              if (isResolved) return;
              isResolved = true;

              stream.removeListener("error", onEvent);
              stream.removeListener("readable", onEvent);
              stream.removeListener("end", onEvent);

              if (err) {
                stream.destroy();
                reject(err);
                return;
              }

              body = stream;
              isFinished = true;

              resolve();
            };

            stream.once("error", onEvent);
            stream.once("readable", onEvent);
            // Empty stream
            stream.once("end", onEvent);

            if (stream.pending === false) {
              onEvent();
            }
          };

          /**
           * @param {string | Buffer} data data
           */
          res.send = (data) => {
            // Hono sets `Content-Length` by default
            context.res.headers.delete("Content-Length");

            body = data;

            isFinished = true;
            resolve();
          };

          /**
           * @param {(string | Buffer)=} data data
           */
          res.finish = (data) => {
            const isDataExist = typeof data !== "undefined";

            // Hono sets `Content-Length` by default
            if (isDataExist) {
              context.res.headers.delete("Content-Length");
            }

            body = isDataExist ? data : null;

            isFinished = true;
            resolve();
          };

          devMiddleware(req, res, (err) => {
            if (err) {
              reject(err);
              return;
            }

            if (!isFinished) {
              resolve();
            }
          });
        },
      );
    } catch (err) {
      if (options?.forwardError) {
        await next();

        // need the return for prevent to execute the code below and override the status and body set by user in the next middleware
        return;
      }
      context.status(500);

      return context.json({ message: /** @type {Error} */ (err).message });
    }

    if (typeof body !== "undefined") {
      return context.body(body, status);
    }

    await next();
  }

  webpackDevMiddleware.devMiddleware = devMiddleware;

  return webpackDevMiddleware;
}

wdm.honoWrapper = honoWrapper;

module.exports = wdm;
