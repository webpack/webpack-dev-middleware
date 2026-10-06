/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {ReturnType<Compiler["getInfrastructureLogger"]>} Logger */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("webpack").StatsCompilation} StatsCompilation */
/** @typedef {import("webpack").StatsError} StatsError */
/** @typedef {import("./index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("./index.js").ServerResponse} ServerResponse */
/** @typedef {import("node:http").Server} HttpServer */
/** @typedef {import("node:stream").Duplex} Duplex */

// The object form only (no presets/booleans) — it is merged over the
// middleware's own base options, which string or boolean forms cannot be.
/** @typedef {import("webpack").StatsOptions} StatsOptions */
/** @typedef {import("webpack").Configuration["stats"]} MiddlewareStatsOption */

/** @typedef {("none" | "error" | "warn" | "info" | "log" | "verbose")} LogLevel */

/**
 * Where the runtime connects, said as the parts that differ. Each is
 * resolved in the page when it is not given.
 * @typedef {object} PathSpec
 * @property {string=} protocol the scheme, or `auto` for the page's
 * @property {string=} hostname the host; every-interface addresses resolve to the page's
 * @property {(string | number)=} port the port; `0` resolves to the page's
 * @property {string=} pathname the path, the resolved `hot.path` by default
 * @property {string=} username the username to authenticate with
 * @property {string=} password the password, sent only alongside a username
 */

/**
 * Everything the browser runtime reads, as it is set in node. One for one with
 * what the entry query carries, so every option has both spellings: set it
 * here and the injected entry carries it, or write it on the query of a client
 * entry of your own.
 *
 * `transport`, `path` and `name` are the exception only in having a default
 * the middleware knows — the resolved `hot.transport`, the resolved `hot.path`
 * and the compilation's name. Setting one here replaces that, which is what a
 * page reaching the endpoint through a proxy or another origin needs.
 * @typedef {object} HotClientOptions
 * @property {("sse" | "ws")=} transport which transport the runtime speaks, `hot.transport` by default
 * @property {(string | PathSpec)=} path where the runtime connects, `hot.path` by default; may be an absolute url for an endpoint on another origin, or the parts that differ with the rest resolved in the page
 * @property {string=} name limit the runtime to one compilation's builds, the compilation's own name by default
 * @property {string=} token the secret the runtime puts on its connection url, `hot.token` by default
 * @property {(boolean | Record<string, EXPECTED_ANY>)=} overlay show build problems and uncaught runtime errors in an overlay
 * @property {(boolean | "circular" | "linear")=} progress show an indicator while a rebuild is in progress
 * @property {boolean=} hot deprecated, removed in the next major release — use `apply`
 * @property {boolean=} liveReload deprecated, removed in the next major release — use `apply`
 * @property {boolean=} reload deprecated, removed in the next major release — use `apply`
 * @property {("hmr" | "hmr-only" | "reload" | "nothing")=} apply what a build does to the page — apply the update and reload if it cannot be applied, apply it and stop with a message if it cannot, load the page again on any build that changed something, or leave the page alone
 * @property {(boolean | { retries?: number, timeout?: number })=} connect whether to connect when the entry runs, and how the connection is held open
 * @property {string=} urlPrefix prefix of the page-url parameter that overrides `apply` for a single page
 * @property {(LogLevel | { level?: LogLevel, name?: string })=} logging how much the runtime logs to the browser console, and the name every message is labelled with
 * @property {number=} reconnect how many times to reconnect before giving up; unset, Server-Sent Events keep trying for as long as the page is open while a WebSocket gives up after 10
 * @property {number=} timeout how long the runtime tolerates silence before reconnecting, in milliseconds — Server-Sent Events only, since a WebSocket's heartbeat is a protocol ping JavaScript cannot see
 * @property {boolean=} autoConnect connect as soon as the entry runs
 * @property {boolean=} dynamicPublicPath prefix the path with the bundle's public path at runtime
 */

/**
 * @typedef {object} HotOptions
 * @property {("sse" | "ws" | ClientStreamFactory<EXPECTED_ANY>)=} transport how events reach the clients, Server-Sent Events by default
 * @property {string=} path the path the endpoint is served at
 * @property {number=} heartbeat heartbeat interval in milliseconds
 * @property {HttpServer=} server HTTP server the `"ws"` transport answers upgrades on, when it is already built
 * @property {StatsOptions=} statsOptions deprecated, removed in the next major release — webpack stats options used when serializing compilation results
 * @property {boolean=} progress publish compilation progress events to the clients
 * @property {CorsOption=} cors which origins may reach the endpoint from a page on another one; the local ones by default
 * @property {(boolean | string)=} token a secret the injected client carries and the endpoint requires; `true` mints one per run, a string uses that one, `false` requires none. Defaults to `false` on both transports; `true` in the next major release
 * @property {boolean=} inject add the hot client entry and `HotModuleReplacementPlugin` to the compilation (default `true`); turn it off to wire them yourself
 * @property {HotClientOptions=} client options handed to the browser runtime through its entry query
 */

/**
 * What an origin is matched against: one origin, several, a pattern, or a
 * question asked of each.
 * @typedef {string | RegExp | (string | RegExp)[] | ((origin: string) => boolean)} CorsOrigin
 */

/**
 * Which origins may read the event stream, as a CORS grant rather than a check:
 * a request is never refused, it is only told whether the browser may hand the
 * response to the page. `false` sends no grant, which leaves the browser's own
 * same-origin rule in place; `true` grants every origin; anything else is
 * matched against the request's own, which is echoed back when it is allowed.
 * `{ origin }` is accepted as well, so a `cors` written for Vite or
 * `expressjs/cors` reads the same here.
 * @typedef {boolean | CorsOrigin | { origin?: CorsOrigin | boolean }} CorsOption
 */

/**
 * What this middleware publishes. `action` is the only part the bundled client
 * reads for dispatch; the rest is what each action carries.
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
 * A payload of someone else's, which `publish` exists to carry.
 *
 * Only `action` is required, since that is all a client needs to tell one
 * apart. Everything beyond it belongs to whoever is publishing — a server with
 * its own `ProgressPlugin` has more to say about a tick than `percent` and
 * `message`, and a `subscribe` handler of theirs is what reads it. Typing it
 * shut would make the published-payload shape this middleware's to approve,
 * which is the opposite of what this is for.
 * @typedef {{ action: string } & Record<string, EXPECTED_ANY>} CustomPayload
 */

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/**
 * The WebSocket members a client is published to through. Structural rather than
 * the ws package's own declarations, which would put an optional dependency's
 * types in the path of every consumer, including those on Server-Sent Events.
 * @typedef {object} WebSocketLikeClient
 * @property {number} readyState the socket's current state
 * @property {number} OPEN the value `readyState` has while the socket is open
 * @property {(data: string) => void} send send a frame to this client
 */

/**
 * What a client is addressed by, which is whatever the transport handed out: the
 * response holding a Server-Sent Events stream, or a WebSocket.
 * @typedef {ServerResponse | WebSocketLikeClient} StreamClient
 */

/**
 * One transport's clients. `createHot` publishes through this and does not know
 * whether the events leave over Server-Sent Events, a WebSocket or something of
 * your own, which is what `TClient` is for: a transport built by a `transport`
 * function names the type of the clients it hands to `onConnect` and takes back
 * in `publishTo`.
 * @template {EXPECTED_ANY} [TClient=StreamClient]
 * @typedef {object} ClientStream
 * @property {((req: IncomingMessage, res: ServerResponse) => void)=} handler answer a request on the endpoint's path; without one a request there is answered `426 Upgrade Required`
 * @property {(() => boolean)=} hasClients true when at least one client is connected; without one a payload is built even if nobody is listening
 * @property {(fn: (client: TClient, req: IncomingMessage) => void) => void} onConnect called with each client once it has joined, and the request it joined with
 * @property {(payload: Payload | CustomPayload) => void} publish publish a payload to every client
 * @property {(client: TClient, payload: Payload | CustomPayload) => void} publishTo publish a payload to a single client
 * @property {() => void} close end every client and stop the heartbeat
 * @property {((server: HttpServer) => void)=} attach answer upgrades on this server
 * @property {(() => void)=} detach stop answering upgrades
 * @property {((req: IncomingMessage, socket: Duplex, head: Buffer) => boolean)=} handleUpgrade answer one upgrade, for a caller that owns the server's `upgrade` event; returns false when the request is not this endpoint's
 */

/**
 * Builds a transport of your own. The same calls `createHot` makes of the
 * built-in two are made of whatever this returns.
 * @template {EXPECTED_ANY} [TClient=StreamClient]
 * @callback ClientStreamFactory
 * @param {{ path: string, heartbeat: number, cors: CorsOption | undefined, token: string | false }} options the endpoint's path and heartbeat interval, the origins it is meant to allow, and the token it should require
 * @param {Logger} logger logger
 * @returns {ClientStream<TClient>} client stream
 */

/** @typedef {ClientStream} EventStream */

// Until the `cors` option existed the endpoint answered every request with
// `Access-Control-Allow-Origin: *`, inherited from `webpack-hot-middleware`,
// which let any site a developer had open read the stream — and with it the
// module paths and source frames a failed build reports. Both transports
// honour it now, each the only way it can be honoured on that wire: the event
// stream withholds the grant, and an upgrade is refused.
// The CORS rules, and the default each transport starts from, live with the
// transport that applies them in `./servers`. What is left here is the mint
// that hands one token to whichever of them is built.
const { resolveToken } = require("./utils.js");

const HOT_DEFAULT_PATH = "/__webpack_hmr";
const HOT_DEFAULT_HEARTBEAT = 10 * 1000;
const HOT_DEFAULT_TRANSPORT = "sse";
const PLUGIN_NAME = "DevMiddleware";

/**
 * Load the module for the transport that was chosen, and only that one.
 *
 * Neither is reached until a `createHot` call picks it: a project on the
 * default Server-Sent Events never parses the WebSocket server or `ws`, one on
 * a WebSocket never parses the event stream, and a transport of its own parses
 * neither. Spelled out per name rather than built from a variable so the path
 * stays statically analysable — a bundler has to be able to see both.
 * @param {"EventSourceServer" | "WebSocketServer"} name which server
 * @returns {EXPECTED_ANY} its factory
 */
function requireServer(name) {
  return name === "WebSocketServer"
    ? require("./servers/WebSocketServer.js")
    : require("./servers/EventSourceServer.js");
}

// What a transport has to do for itself. Missing one of these would throw from
// wherever the stream is first published to, which is a long way from the
// option that built it.
const CLIENT_STREAM_METHODS = ["close", "onConnect", "publish", "publishTo"];

// What it may also do. Absent is fine; present and not a function is not — that
// would pass startup and throw from the endpoint or a progress callback later,
// which is the failure being validated against in the first place.
const OPTIONAL_CLIENT_STREAM_METHODS = [
  "attach",
  "detach",
  "handleUpgrade",
  "handler",
  "hasClients",
];

// TODO remove in the next major release, along with the `handler` and
// `hasClients` entries in `ClientStream`. Both were required of every transport
// when `hot.transport` shipped, and neither needs to be: `handler` is
// meaningless for a transport that is not served over HTTP — the built-in
// WebSocket one only had it to answer 426 — and `hasClients` is an
// optimization a transport can make inside `publish`. They stay optional
// rather than being dropped now so a transport written against 8.3.0 keeps
// working.
//
// Answers a request on the endpoint's path for a transport that has no
// `handler`: reaching it over plain HTTP means the client cannot speak this
// transport at all.
/** @type {(req: IncomingMessage, res: ServerResponse) => void} */
const upgradeRequired = (req, res) => {
  if (!res.headersSent) {
    res.writeHead(426, { "Content-Type": "text/plain; charset=utf-8" });
  }

  if (!res.writableEnded) {
    res.end("Upgrade Required");
  }
};

/**
 * @param {ClientStream<EXPECTED_ANY>} stream what a `transport` function returned
 * @returns {ClientStream<EXPECTED_ANY>} the same stream
 */
function checkClientStream(stream) {
  const missing =
    stream && typeof stream === "object"
      ? CLIENT_STREAM_METHODS.filter(
          (method) =>
            typeof (/** @type {Record<string, unknown>} */ (stream)[method]) !==
            "function",
        )
      : CLIENT_STREAM_METHODS;

  if (missing.length > 0) {
    throw new TypeError(
      `The 'hot.transport' function must return a client stream, which is missing: ${missing.join(", ")}.`,
    );
  }

  const notFunctions = OPTIONAL_CLIENT_STREAM_METHODS.filter((method) => {
    const value = /** @type {Record<string, unknown>} */ (stream)[method];

    return value !== undefined && typeof value !== "function";
  });

  if (notFunctions.length > 0) {
    throw new TypeError(
      `The 'hot.transport' function returned a client stream whose optional ${notFunctions.length === 1 ? "method is" : "methods are"} not callable: ${notFunctions.join(", ")}.`,
    );
  }

  return stream;
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

  // The same shape the browser runtime builds from an error object, so a
  // problem reads the same whether this formatted it or a server sent the
  // object over and `client/problem` did. Written out rather than shared:
  // this half is CommonJS in node, that half is an ES module in a bundle.
  return /** @type {StatsError[]} */ (errors).map((error) => {
    const file = error.file || "";
    const request = error.moduleName || "";
    const loaded = request.includes("!");
    const moduleName = loaded ? request.replace(/^(\s|\S)*!/, "") : request;

    let where = moduleName || file;

    if (where) {
      if (loaded) {
        where += ` (${request})`;
      }

      if (moduleName && file && file !== moduleName) {
        where += ` (${file})`;
      }

      if (error.loc) {
        where += ` ${error.loc}`;
      }
    }

    // Nothing on the first line rather than a line holding a single space,
    // which is what an error webpack names no module for used to send — and
    // the overlay reads that first line as the heading.
    return where ? `${where}\n${error.message}` : `${error.message}`;
  });
}

/**
 * Which diagnostics a payload carries follows the middleware's `stats` option,
 * so one setting governs what a build reports in the terminal and in the
 * browser. Resolved per compilation, because only webpack knows what a preset
 * like `"errors-only"` means.
 * @param {Stats} stats stats
 * @param {MiddlewareStatsOption} statsOption the middleware's `stats` option
 * @returns {{ errors: boolean, warnings: boolean }} diagnostics to serialize
 */
function diagnosticsFrom(stats, statsOption) {
  if (typeof statsOption === "undefined" || !stats.compilation) {
    return { errors: true, warnings: true };
  }

  const resolved = stats.compilation.createStatsOptions(statsOption, {
    forToString: false,
  });

  return {
    errors: Boolean(resolved.errors),
    warnings: Boolean(resolved.warnings),
  };
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
 * @param {Stats | MultiStats} statsResult stats result
 * @param {StatsOptions | undefined} statsOptions deprecated `hot.statsOptions`
 * @param {MiddlewareStatsOption=} statsOption the middleware's `stats` option
 * @returns {StatsCompilation[]} normalized per-bundle stats
 */
function toBundles(statsResult, statsOptions, statsOption) {
  /**
   * @param {Stats} stats stats of one compilation
   * @returns {StatsOptions} what to ask `toJson` for
   */
  const optionsFor = (stats) => ({
    all: false,
    ...diagnosticsFrom(stats, statsOption),
    // TODO in the next major release remove `statsOptions` and this spread
    ...statsOptions,
    // Not negotiable, whatever the options above ask for: without `hash` the
    // client has nothing to compare and stops applying updates, without
    // `timings` it reports `undefined` build times, and with `children` the
    // payload would carry a child compilation's hash instead of the bundle's.
    hash: true,
    timings: true,
    children: false,
  });

  // Multi-compiler stats have stats for each child compiler.
  if ("stats" in statsResult) {
    return statsResult.stats.map((stats) =>
      normalizeStats(stats, optionsFor(stats)),
    );
  }

  return [normalizeStats(statsResult, optionsFor(statsResult))];
}

/**
 * @param {StatsCompilation} stats normalized per-bundle stats
 * @param {"built" | "sync"} action action
 * @returns {Payload} SSE payload
 */
function bundlePayload(stats, action) {
  return {
    name: stats.name || "",
    action,
    time: stats.time,
    hash: stats.hash,
    warnings: formatErrors(stats.warnings || []),
    errors: formatErrors(stats.errors || []),
  };
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
  // Grouped once up front so pairing stays linear with many child compilers.
  /** @type {Map<string, StatsCompilation[]>} */
  const previousByName = new Map();

  if (previousBundles !== null) {
    for (const bundle of previousBundles) {
      const name = bundle.name || "";
      const group = previousByName.get(name);

      if (group) {
        group.push(bundle);
      } else {
        previousByName.set(name, [bundle]);
      }
    }
  }

  /** @type {Map<string, number>} */
  const occurrences = new Map();

  for (const [index, stats] of bundles.entries()) {
    const name = stats.name || "";

    // Paired by name so a changing set of compilations (children appearing,
    // config reloads) cannot compare a bundle against a sibling's hash.
    // Webpack does not forbid duplicate names, so same-named bundles pair by
    // occurrence; unnamed bundles fall back to their position.
    let previous = null;

    if (previousBundles !== null) {
      if (name) {
        const occurrence = occurrences.get(name) || 0;
        occurrences.set(name, occurrence + 1);
        const group = previousByName.get(name);
        previous = (group && group[occurrence]) || null;
      } else {
        previous = previousBundles[index] || null;
      }
    }

    const changed =
      previousBundles === null ||
      previous === null ||
      previous.hash !== stats.hash;

    eventStream.publish(bundlePayload(stats, changed ? "built" : "sync"));
  }
}

/**
 * @typedef {object} HotInstance
 * @property {string} path path the endpoint is served at
 * @property {("sse" | "ws" | ClientStreamFactory<EXPECTED_ANY>)} transport how events reach the clients
 * @property {string | false} token the secret the endpoint requires, or false when it requires none; the injected client is given it
 * @property {(server: HttpServer) => void} attach answer WebSocket upgrades on this server, a no-op for Server-Sent Events
 * @property {(req: IncomingMessage, socket: Duplex, head: Buffer) => boolean} handleUpgrade answer one WebSocket upgrade, for a caller that owns the server's `upgrade` event and wants to decide each one; returns false when the request is not the endpoint's, or the transport does not answer upgrades
 * @property {(fn: (client: EXPECTED_ANY, req: IncomingMessage) => void) => void} onConnect called with each client once it has joined, and the request it joined with, before anything is published to it
 * @property {(req: IncomingMessage, res: ServerResponse) => void} handle answer a request on the endpoint's path
 * @property {(payload: Payload | CustomPayload) => void} publish publish a payload to every client
 * @property {(client: EXPECTED_ANY, payload: Payload | CustomPayload) => void} publishTo publish a payload to one client, for answering a single connection
 * @property {() => void} close end every client and detach the heartbeat
 */

/**
 * @param {Compiler | MultiCompiler} compiler compiler
 * @param {HotOptions | true} userOptions options
 * @param {MiddlewareStatsOption=} statsOption the middleware's `stats` option, which decides whether a payload carries errors and warnings
 * @returns {HotInstance} hot instance
 */
function createHot(compiler, userOptions, statsOption) {
  const options = userOptions === true ? {} : userOptions;
  const path = options.path || HOT_DEFAULT_PATH;
  const heartbeat = options.heartbeat ?? HOT_DEFAULT_HEARTBEAT;
  const transport = options.transport || HOT_DEFAULT_TRANSPORT;
  const { cors } = options;
  const { statsOptions } = options;
  // `inject: false` turns it off: the token reaches the browser through the
  // entry this middleware adds, so with nothing injected there is no way to
  // hand one over, and requiring it would refuse a client the developer wired
  // correctly. Off by default either way — see `HOT_DEFAULT_TOKEN`.
  const token = resolveToken(
    options.inject === false ? (options.token ?? false) : options.token,
  );
  const logger = compiler.getInfrastructureLogger("webpack-dev-middleware");

  // TODO in the next major release remove `statsOptions` and this warning
  if (statsOptions) {
    logger.warn(
      "The 'hot.statsOptions' option is deprecated and will be removed in the next major release. Until then it still applies, apart from 'hash', 'timings' and 'children', which the client needs to apply an update. What a payload reports now follows the 'stats' option, and the browser console is the client's own '?logging=' and '?overlay=' options; to drop a warning everywhere at once, use webpack's 'ignoreWarnings'.",
    );
  }

  /** @type {ClientStream<EXPECTED_ANY>} */
  let eventStream;
  /** @type {string} */
  let transportName;

  if (typeof transport === "function") {
    eventStream = checkClientStream(
      transport({ heartbeat, path, cors, token }, logger),
    );
    transportName = "a custom transport";
  } else if (transport === "ws") {
    eventStream = requireServer("WebSocketServer")(
      { heartbeat, path, cors, token },
      logger,
    );
    transportName = "a WebSocket";
  } else {
    eventStream = requireServer("EventSourceServer")(
      heartbeat,
      logger,
      cors,
      token,
    );
    transportName = "Server-Sent Events";
  }

  logger.log(
    `Hot module replacement enabled, serving events at "${path}" over ${transportName}`,
  );

  // `latestBundles` survives rebuilds so hashes can be compared per build.
  /** @type {StatsCompilation[] | null} */
  let latestBundles = null;
  let valid = false;
  let closed = false;
  let lastProgressPercent = -1;

  // A transport takes one connect callback, so the subscribers are kept here
  // instead.
  /** @type {((client: EXPECTED_ANY, req: IncomingMessage) => void)[]} */
  const connectListeners = [];

  eventStream.onConnect((client, req) => {
    // Subscribers run before the catch-up, so one that closes a client it does
    // not want has done so by the time anything is published to it. Nothing
    // here has to notice: `publishTo` already declines to write to a client
    // that is no longer open.
    for (const listener of connectListeners) {
      listener(client, req);
    }

    // A listener is arbitrary code, and closing the middleware from one is a
    // reasonable thing for it to do — there would be no stream left to catch
    // this client up on.
    if (closed || !valid || !latestBundles) {
      return;
    }

    // Catch a new client up wherever it joined from, as `sync` events carrying
    // the last hashes.
    for (const stats of latestBundles) {
      eventStream.publishTo(client, bundlePayload(stats, "sync"));
    }
  });

  // A WebSocket is upgraded by the HTTP server rather than answered by the
  // middleware, so the transport needs the server itself.
  if (options.server && eventStream.attach) {
    eventStream.attach(options.server);
  }

  // TODO in the next major release remove `progress` and this warning
  if (options.progress) {
    logger.warn(
      "The 'hot.progress' option is deprecated and will be removed in the next major release. Measuring a build is the server's call, not the middleware's: a server that applies 'ProgressPlugin' itself — webpack-dev-server does — ends up with two of them on one compiler. Remove 'hot.progress', apply it yourself and hand what it reports to the middleware's 'publish' method, rounding the percent and dropping a tick that repeats one as this option did for you — the example is at https://github.com/webpack/webpack-dev-middleware#publishpayload. Until then this keeps working.",
    );

    const { webpack } =
      "compilers" in compiler ? compiler.compilers[0] : compiler;

    // Published only when the rounded percent changes to keep the stream small.
    new webpack.ProgressPlugin((percent, message) => {
      // No `hasClients` means the transport did not offer to answer, so the
      // payload is built and it decides in `publish`.
      if (closed || (eventStream.hasClients && !eventStream.hasClients())) {
        return;
      }

      const rounded = Math.round(percent * 100);

      if (rounded === lastProgressPercent) {
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

  /**
   * @param {string=} name name of the compilation the hook belongs to
   * @returns {(fileName?: string | null) => void} invalid hook handler
   */
  const onInvalid = (name) => (fileName) => {
    if (closed) return;

    valid = false;
    lastProgressPercent = -1;

    /** @type {{ action: string, name?: string, file?: string }} */
    const payload = { action: "building" };

    // Named so clients can pair this event with the `built`/`sync` that
    // follows it — the building indicator tracks in-flight builds per name.
    if (name) {
      payload.name = name;
    }

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

    const bundles = toBundles(statsResult, statsOptions, statsOption);

    publishBundles(bundles, latestBundles, eventStream);
    latestBundles = bundles;
    valid = true;
  };

  // Tapped per child compiler rather than on the MultiCompiler hook, which
  // does not say which compilation invalidated.
  for (const child of "compilers" in compiler
    ? compiler.compilers
    : [compiler]) {
    child.hooks.invalid.tap(PLUGIN_NAME, onInvalid(child.name));
  }
  compiler.hooks.done.tap(PLUGIN_NAME, onDone);

  return {
    path,
    transport,
    token,
    attach(server) {
      if (closed || !eventStream.attach) {
        return;
      }

      eventStream.attach(server);
    },
    onConnect(fn) {
      connectListeners.push(fn);
    },
    handleUpgrade(req, socket, head) {
      if (closed || !eventStream.handleUpgrade) {
        return false;
      }

      return eventStream.handleUpgrade(req, socket, head);
    },
    handle(req, res) {
      // A request can race `close()` past the middleware intercept — end it
      // instead of leaving it hanging without a response.
      if (closed) {
        res.writeHead(404);
        res.end();

        return;
      }

      // Called as a method, not through a picked-off reference: a transport
      // whose `handler` reaches for `this` was working before this became
      // optional, and must keep working.
      if (eventStream.handler) {
        eventStream.handler(req, res);
      } else {
        upgradeRequired(req, res);
      }
    },
    publish(payload) {
      if (closed) return;

      // No `hasClients` means the transport did not offer to answer, so the
      // payload goes to it and it decides. This is a public entry point —
      // something outside publishing on every ProgressPlugin tick should not
      // pay for a stream nobody is reading.
      if (eventStream.hasClients && !eventStream.hasClients()) return;

      eventStream.publish(payload);
    },
    publishTo(client, payload) {
      if (closed) return;

      // No `hasClients` guard: the caller named the client, so it knows
      // someone is listening. This is for answering one connection, which a
      // server refusing it has to be able to do without knowing which
      // transport is carrying it — a WebSocket client and an event-stream
      // client are not the same kind of object. A transport declines to write
      // to a client that is no longer open.
      eventStream.publishTo(client, payload);
    },
    close() {
      if (closed) return;

      // Can't remove compiler plugins, so we set a flag and noop if closed.
      // https://github.com/webpack/tapable/issues/32#issuecomment-350644466
      closed = true;
      eventStream.close();
      eventStream = /** @type {ClientStream<EXPECTED_ANY>} */ (
        /** @type {unknown} */ (null)
      );
    },
  };
}

module.exports = createHot;
module.exports.HOT_DEFAULT_HEARTBEAT = HOT_DEFAULT_HEARTBEAT;
module.exports.HOT_DEFAULT_PATH = HOT_DEFAULT_PATH;
module.exports.HOT_DEFAULT_TRANSPORT = HOT_DEFAULT_TRANSPORT;
module.exports.checkClientStream = checkClientStream;
/**
 * Kept as an export, loaded on the first call rather than with this module.
 * @param {number} heartbeat heartbeat interval in milliseconds
 * @param {Logger} logger logger
 * @param {CorsOption=} cors which origins may read the stream
 * @param {(string | false)=} token the token the endpoint requires, or false for none
 * @returns {EventStream} event stream
 */
module.exports.createEventStream = (heartbeat, logger, cors, token) =>
  requireServer("EventSourceServer")(heartbeat, logger, cors, token);
module.exports.createHot = createHot;
module.exports.formatErrors = formatErrors;
module.exports.publishBundles = publishBundles;
module.exports.toBundles = toBundles;
