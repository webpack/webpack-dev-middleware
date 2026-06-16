/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {ReturnType<Compiler["getInfrastructureLogger"]>} Logger */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("webpack").StatsCompilation} StatsCompilation */
/** @typedef {import("webpack").StatsError} StatsError */
/** @typedef {import("webpack").StatsModule} StatsModule */
/** @typedef {import("./index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("./index.js").ServerResponse} ServerResponse */

/** @typedef {NonNullable<import("webpack").Configuration["stats"]>} StatsOptions */

/**
 * @typedef {object} HotOptions
 * @property {string=} path the path the SSE endpoint is served at
 * @property {number=} heartbeat heartbeat interval in milliseconds
 * @property {StatsOptions=} statsOptions webpack stats options used when serializing compilation results
 */

/**
 * @typedef {object} Payload
 * @property {string} action action
 * @property {string=} name name
 * @property {number=} time time
 * @property {string=} hash hash
 * @property {string[]=} warnings warnings
 * @property {string[]=} errors errors
 * @property {Record<string, string>=} modules modules
 */

/**
 * @typedef {object} EventStream
 * @property {(req: IncomingMessage, res: ServerResponse) => void} handler attach a new client
 * @property {(payload: Payload | { action: string }) => void} publish publish a payload to every client
 * @property {() => void} close end every client and stop the heartbeat
 */

const HOT_DEFAULT_PATH = "/__webpack_hmr";
const HOT_DEFAULT_HEARTBEAT = 10 * 1000;
const PLUGIN_NAME = "DevMiddleware";

/**
 * @param {string | undefined} url url
 * @param {string} expected expected pathname
 * @returns {boolean} true when the url pathname matches the expected path
 */
function pathMatch(url, expected) {
  if (!url) return false;

  try {
    return new URL(url, "http://localhost").pathname === expected;
  } catch {
    return false;
  }
}

/**
 * @param {number} heartbeat heartbeat interval in milliseconds
 * @param {Logger} logger logger
 * @returns {EventStream} event stream
 */
function createEventStream(heartbeat, logger) {
  let clientId = 0;
  /** @type {Map<number, ServerResponse>} */
  let clients = new Map();

  /**
   * @param {(client: ServerResponse) => void} fn each client callback
   */
  const everyClient = (fn) => {
    for (const client of clients.values()) {
      fn(client);
    }
  };

  const interval = setInterval(() => {
    everyClient((client) => {
      client.write("data: 💓\n\n");
    });
  }, heartbeat);

  // Don't block process exit on the heartbeat timer.
  if (typeof interval.unref === "function") {
    interval.unref();
  }

  return {
    close() {
      clearInterval(interval);
      everyClient((client) => {
        if (!client.writableEnded) {
          client.end();
        }
      });
      clients = new Map();
    },
    handler(req, res) {
      /** @type {Record<string, string>} */
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "text/event-stream;charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        // While behind nginx, the event stream should not be buffered:
        // http://nginx.org/docs/http/ngx_http_proxy_module.html#proxy_buffering
        "X-Accel-Buffering": "no",
      };

      const { httpVersion, socket } = req;
      const isHttp1 = !(Number.parseInt(httpVersion, 10) >= 2);

      if (isHttp1) {
        if (socket && typeof socket.setKeepAlive === "function") {
          socket.setKeepAlive(true);
        }
        headers.Connection = "keep-alive";
      }

      res.writeHead(200, headers);
      res.write("\n");

      const id = clientId++;
      clients.set(id, res);
      logger.log(`Client connected (${clients.size} active)`);

      req.on("close", () => {
        if (!res.writableEnded) {
          res.end();
        }
        clients.delete(id);
        logger.log(`Client disconnected (${clients.size} active)`);
      });
    },
    publish(payload) {
      everyClient((client) => {
        client.write(`data: ${JSON.stringify(payload)}\n\n`);
      });
    },
  };
}

/**
 * @param {(string | StatsError)[]} errors errors or warnings
 * @returns {string[]} flat strings
 */
function formatErrors(errors) {
  if (!errors || errors.length === 0) {
    return [];
  }

  if (typeof errors[0] === "string") {
    return /** @type {string[]} */ (errors);
  }

  return /** @type {StatsError[]} */ (errors).map((error) => {
    const moduleName = error.moduleName || "";
    const loc = error.loc || "";

    return `${moduleName} ${loc}\n${error.message}`;
  });
}

/**
 * @param {Stats} stats stats
 * @param {StatsOptions} statsOptions stats options
 * @returns {StatsCompilation} json stats with compilation reference attached
 */
function normalizeStats(stats, statsOptions) {
  const statsJson = stats.toJson(statsOptions);

  if (stats.compilation) {
    statsJson.compilation = stats.compilation;
  }

  return statsJson;
}

/**
 * @param {StatsCompilation} stats normalized stats
 * @returns {StatsCompilation[]} extracted bundles
 */
function extractBundles(stats) {
  if (stats.modules) {
    return [stats];
  }

  if (stats.children && stats.children.length > 0) {
    return stats.children;
  }

  return [stats];
}

/**
 * @param {StatsModule[]} modules modules
 * @returns {Record<string, string>} module id to name map
 */
function buildModuleMap(modules) {
  /** @type {Record<string, string>} */
  const map = {};

  for (const item of modules) {
    map[/** @type {string | number} */ (item.id)] = /** @type {string} */ (
      item.name
    );
  }

  return map;
}

/**
 * @param {string} action action
 * @param {Stats | MultiStats} statsResult stats result
 * @param {EventStream} eventStream event stream
 * @param {StatsOptions | undefined} statsOptions stats options
 */
function publishStats(action, statsResult, eventStream, statsOptions) {
  const resultStatsOptions = {
    all: false,
    hash: true,
    timings: true,
    errors: true,
    warnings: true,
    ...(statsOptions && typeof statsOptions === "object" ? statsOptions : {}),
  };

  /** @type {StatsCompilation[]} */
  let bundles;

  // Multi-compiler stats have stats for each child compiler.
  if ("stats" in statsResult) {
    bundles = statsResult.stats.flatMap((stats) =>
      extractBundles(normalizeStats(stats, resultStatsOptions)),
    );
  } else {
    bundles = extractBundles(normalizeStats(statsResult, resultStatsOptions));
  }

  for (const stats of bundles) {
    let name = stats.name || "";

    // Fallback to compilation name when there is a single bundle.
    if (!name && stats.compilation) {
      name = stats.compilation.name || "";
    }

    eventStream.publish({
      name,
      action,
      time: stats.time,
      hash: stats.hash,
      warnings: formatErrors(stats.warnings || []),
      errors: formatErrors(stats.errors || []),
      modules: buildModuleMap(stats.modules || []),
    });
  }
}

/**
 * @typedef {object} HotInstance
 * @property {string} path path the SSE endpoint is served at
 * @property {(req: IncomingMessage, res: ServerResponse) => void} handle attach the request as a SSE client
 * @property {(payload: Payload | { action: string }) => void} publish publish a payload to every client
 * @property {() => void} close end every client and detach the heartbeat
 */

/**
 * @param {Compiler | MultiCompiler} compiler compiler
 * @param {HotOptions | true} userOptions options
 * @returns {HotInstance} hot instance
 */
function createHot(compiler, userOptions) {
  const options = userOptions === true ? {} : userOptions;
  const path = options.path || HOT_DEFAULT_PATH;
  const heartbeat = options.heartbeat || HOT_DEFAULT_HEARTBEAT;
  const { statsOptions } = options;
  const logger = compiler.getInfrastructureLogger("webpack-dev-middleware");

  let eventStream = createEventStream(heartbeat, logger);
  logger.log(`Hot module replacement enabled, serving events at "${path}"`);
  /** @type {Stats | MultiStats | null} */
  let latestStats = null;
  let closed = false;

  const onInvalid = () => {
    if (closed) return;

    latestStats = null;

    eventStream.publish({ action: "building" });
  };

  /** @param {Stats | MultiStats} statsResult stats result */
  const onDone = (statsResult) => {
    if (closed) return;

    latestStats = statsResult;
    publishStats("built", latestStats, eventStream, statsOptions);
  };

  compiler.hooks.invalid.tap(PLUGIN_NAME, onInvalid);
  compiler.hooks.done.tap(PLUGIN_NAME, onDone);

  return {
    path,
    handle(req, res) {
      if (closed) return;

      eventStream.handler(req, res);

      if (latestStats) {
        publishStats("sync", latestStats, eventStream, statsOptions);
      }
    },
    publish(payload) {
      if (closed) return;

      eventStream.publish(payload);
    },
    close() {
      if (closed) return;

      // Can't remove compiler plugins, so we set a flag and noop if closed.
      // https://github.com/webpack/tapable/issues/32#issuecomment-350644466
      closed = true;
      eventStream.close();
      eventStream = /** @type {EventStream} */ (/** @type {unknown} */ (null));
    },
  };
}

module.exports = createHot;
module.exports.HOT_DEFAULT_HEARTBEAT = HOT_DEFAULT_HEARTBEAT;
module.exports.HOT_DEFAULT_PATH = HOT_DEFAULT_PATH;
module.exports.buildModuleMap = buildModuleMap;
module.exports.createEventStream = createEventStream;
module.exports.createHot = createHot;
module.exports.formatErrors = formatErrors;
module.exports.pathMatch = pathMatch;
module.exports.publishStats = publishStats;
