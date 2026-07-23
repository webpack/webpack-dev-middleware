/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {ReturnType<Compiler["getInfrastructureLogger"]>} Logger */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("webpack").StatsCompilation} StatsCompilation */
/** @typedef {import("webpack").StatsError} StatsError */
/** @typedef {import("./index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("./index.js").ServerResponse} ServerResponse */

/** @typedef {NonNullable<import("webpack").Configuration["stats"]>} StatsOptions */

/**
 * @typedef {object} HotOptions
 * @property {string=} path the path the SSE endpoint is served at
 * @property {number=} heartbeat heartbeat interval in milliseconds
 * @property {StatsOptions=} statsOptions webpack stats options used when serializing compilation results
 * @property {boolean=} progress publish compilation progress events to the clients
 */

/**
 * @typedef {object} Payload
 * @property {string} action action
 * @property {string=} file file that invalidated the compilation
 * @property {string=} name name
 * @property {number=} time time
 * @property {string=} hash hash
 * @property {number=} percent compilation progress (0-100)
 * @property {string=} message progress message
 * @property {string[]=} warnings warnings
 * @property {string[]=} errors errors
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
 * @returns {StatsCompilation} json stats with the compilation name resolved
 */
function normalizeStats(stats, statsOptions) {
  const statsJson = stats.toJson(statsOptions);

  // Resolved here so stored bundles do not retain Compilation objects.
  if (!statsJson.name && stats.compilation) {
    statsJson.name = stats.compilation.name || "";
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
 * @param {Stats | MultiStats} statsResult stats result
 * @param {StatsOptions | undefined} statsOptions stats options
 * @returns {StatsCompilation[]} normalized per-bundle stats
 */
function toBundles(statsResult, statsOptions) {
  const resultStatsOptions = {
    all: false,
    hash: true,
    timings: true,
    errors: true,
    warnings: true,
    ...(statsOptions && typeof statsOptions === "object" ? statsOptions : {}),
  };

  // Multi-compiler stats have stats for each child compiler.
  if ("stats" in statsResult) {
    return statsResult.stats.flatMap((stats) =>
      extractBundles(normalizeStats(stats, resultStatsOptions)),
    );
  }

  return extractBundles(normalizeStats(statsResult, resultStatsOptions));
}

/**
 * Publish one event per bundle. Bundles whose hash did not change are
 * published as `sync`, so their clients do not fetch a hot-update manifest
 * that was never emitted.
 * @param {StatsCompilation[]} bundles bundles from the current build
 * @param {StatsCompilation[] | null} previousBundles bundles from the previous build (null on the first build, which publishes everything as `built`)
 * @param {EventStream} eventStream event stream
 */
function publishBundles(bundles, previousBundles, eventStream) {
  for (const [index, stats] of bundles.entries()) {
    const name = stats.name || "";

    const changed =
      previousBundles === null ||
      !previousBundles[index] ||
      previousBundles[index].hash !== stats.hash;

    eventStream.publish({
      name,
      action: changed ? "built" : "sync",
      time: stats.time,
      hash: stats.hash,
      warnings: formatErrors(stats.warnings || []),
      errors: formatErrors(stats.errors || []),
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

  // `latestBundles` survives rebuilds so hashes can be compared per build.
  /** @type {StatsCompilation[] | null} */
  let latestBundles = null;
  let valid = false;
  let closed = false;
  let lastProgressPercent = -1;

  if (options.progress) {
    const { webpack } =
      "compilers" in compiler ? compiler.compilers[0] : compiler;

    // Published only when the rounded percent changes to keep the stream small.
    new webpack.ProgressPlugin((percent, message) => {
      const rounded = Math.round(percent * 100);

      if (closed || rounded === lastProgressPercent) {
        return;
      }

      lastProgressPercent = rounded;
      eventStream.publish({
        action: "progress",
        percent: rounded,
        message: message || "",
      });
    }).apply(compiler);
  }

  /** @param {string | null=} fileName file that triggered the rebuild */
  const onInvalid = (fileName) => {
    if (closed) return;

    valid = false;
    lastProgressPercent = -1;

    /** @type {{ action: string, file?: string }} */
    const payload = { action: "building" };

    // The invalid hook reports which file changed — forward it so clients
    // can show what triggered the rebuild.
    if (typeof fileName === "string" && fileName) {
      payload.file = fileName;
    }

    eventStream.publish(payload);
  };

  /** @param {Stats | MultiStats} statsResult stats result */
  const onDone = (statsResult) => {
    if (closed) return;

    const bundles = toBundles(statsResult, statsOptions);

    publishBundles(bundles, latestBundles, eventStream);
    latestBundles = bundles;
    valid = true;
  };

  compiler.hooks.invalid.tap(PLUGIN_NAME, onInvalid);
  compiler.hooks.done.tap(PLUGIN_NAME, onDone);

  return {
    path,
    handle(req, res) {
      if (closed) return;

      eventStream.handler(req, res);

      // Catch the new client up; self-comparison publishes everything as `sync`.
      if (valid && latestBundles) {
        publishBundles(latestBundles, latestBundles, eventStream);
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
module.exports.createEventStream = createEventStream;
module.exports.createHot = createHot;
module.exports.formatErrors = formatErrors;
module.exports.pathMatch = pathMatch;
module.exports.publishBundles = publishBundles;
module.exports.toBundles = toBundles;
