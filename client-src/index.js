/* global __resourceQuery, __webpack_dev_server_client__, __webpack_hash__, __webpack_public_path__ */

// This file is bundled by webpack into a browser bundle, so it is compiled to
// ES5 (see `babel.config.js`) and sticks to ES5 runtime APIs — `EventSource`
// and `Promise` (both required by HMR itself) are the only exceptions.

import EventSourceClient from "./clients/EventSourceClient.js";
import WebSocketClient from "./clients/WebSocketClient.js";
import createSocket from "./clients/createSocket.js";
import * as indicator from "./indicator.js";
import configureOverlay from "./overlay.js";
import applyUpdate from "./process-update.js";
import { log, setLogLevel, setLogName } from "./utils/log.js";
import reloadPage from "./utils/reload.js";
import sendMessage from "./utils/send-message.js";
import socketOptions from "./utils/socket-options.js";
import resolveSocketUrl from "./utils/socket-url.js";
import stripAnsi from "./utils/strip-ansi.js";
import withToken from "./utils/with-token.js";

/** @typedef {import("./utils/log.js").LogLevel} LogLevel */

/**
 * Superset of webpack-dev-server's `client.overlay` object; `styles`,
 * `ansiColors`, `openEditorEndpoint` and `paginate` are webpack-dev-middleware
 * extensions.
 * @typedef {object} OverlayOptions
 * @property {(boolean | ((error: string) => boolean))=} errors show build errors in the overlay
 * @property {(boolean | ((warning: string) => boolean))=} warnings show build warnings in the overlay
 * @property {(boolean | ((error: Error) => boolean))=} runtimeErrors show uncaught runtime errors and unhandled rejections in the overlay
 * @property {string=} trustedTypesPolicyName Trusted Types policy name used for the overlay's HTML
 * @property {Record<string, string | number>=} styles overrides for the overlay card CSS
 * @property {Record<string, string | string[]>=} ansiColors overrides for ANSI → HTML color mapping
 * @property {string=} openEditorEndpoint endpoint the overlay calls (GET `?fileName=file:line:column`) when a file reference is clicked; empty disables it
 * @property {boolean=} paginate show one problem at a time with prev/next navigation
 * @property {string=} id id of the overlay element, for a package embedding this overlay that has its own id to keep
 */

/**
 * What a build does to the page. One option rather than three booleans,
 * because only four of their eight combinations differed: `liveReload` was
 * read only when Hot Module Replacement was off, and `reload` only when it
 * was on.
 *
 * - `"hmr"` — apply the update; reload if it cannot be applied
 * - `"hmr-only"` — apply the update; say so and stop if it cannot be applied
 * - `"reload"` — no Hot Module Replacement, reload on a build that changed something
 * - `"nothing"` — leave the page alone until it is reloaded by hand
 * @typedef {("hmr" | "hmr-only" | "reload" | "nothing")} ApplyMode
 */

/**
 * @typedef {object} ConnectOptions
 * @property {number=} retries how many times to reconnect before giving up
 * @property {number=} timeout how long silence is tolerated before reconnecting, in milliseconds — Server-Sent Events only
 */

/**
 * @typedef {object} ClientOptions
 * @property {("sse" | "ws")} transport how the events are carried, matching the server's `hot.transport`
 * @property {string} path endpoint path
 * @property {ApplyMode} apply what a build does to the page
 * @property {boolean | ConnectOptions} connect whether to connect when the entry runs, and how the connection is held open
 * @property {boolean | OverlayOptions} overlay enable the in-page error overlay (same value shape as webpack-dev-server's `client.overlay`)
 * @property {string} urlPrefix prefix of the page-url parameters that override `apply` for one page
 * @property {LogLevel} logging logger level
 * @property {string=} loggerName what to label messages with in the console
 * @property {string} name limit updates to this compilation name
 * @property {string} token the secret the endpoint requires, when it requires one, put on the connection url — empty when it requires none
 * @property {boolean | "circular" | "linear"} progress show an indicator while a rebuild is in progress — `true` and `"circular"` a small badge, `"linear"` a thin bar across the top of the viewport
 */

// The reporter is a singleton on the page (see `REPORTER_KEY` below). Declared
// here, with the options, because the connection's own hooks reach for it and
// are defined well before it is assigned.
/** @type {ReturnType<typeof createReporter> | undefined} */
let reporter;

// Where the endpoint is served, when nothing says otherwise. Also the path a
// url spec falls back to when it names every part but that one.
const DEFAULT_PATH = "/__webpack_hmr";

/** @type {ClientOptions} */
const options = {
  transport: "sse",
  path: DEFAULT_PATH,
  apply: "hmr",
  connect: true,
  overlay: true,
  urlPrefix: "webpack-dev-middleware",
  logging: "info",
  loggerName: "",
  name: "",
  // The secret the endpoint requires, when it requires one. Put on the url
  // rather than sent as a header: neither `EventSource` nor `WebSocket` lets a
  // page set one.
  token: "",
  progress: true,
};

/**
 * Parse the entry's resource query. Hand-rolled (rather than through
 * `URLSearchParams`, which an ES5 browser does not have) with the same
 * decoding: `+` is a space and values are percent-decoded.
 * @param {string} query resource query, starting with `?`
 * @returns {Record<string, string>} query parameters
 */
function parseQuery(query) {
  /** @type {Record<string, string>} */
  const parameters = {};

  /**
   * A malformed escape — a page url such as `?discount=50%`, which a browser
   * leaves as it is — is kept as written rather than thrown: this parses the
   * page's own url on every build, and one bad parameter must not stop every
   * update from being applied.
   * @param {string} value raw value
   * @returns {string} decoded value
   */
  const decode = (value) => {
    const spaced = value.replace(/\+/g, " ");

    try {
      return decodeURIComponent(spaced);
    } catch {
      return spaced;
    }
  };

  for (const pair of query.slice(1).split("&")) {
    if (!pair) {
      continue;
    }

    const separator = pair.indexOf("=");

    parameters[decode(separator === -1 ? pair : pair.slice(0, separator))] =
      separator === -1 ? "" : decode(pair.slice(separator + 1));
  }

  return parameters;
}

/**
 * Turn the string values that `errors`/`warnings`/`runtimeErrors` may carry
 * in the resource query into filter functions (same behavior as
 * webpack-dev-server).
 * @param {boolean | OverlayOptions} overlayOptions overlay options
 */
function decodeOverlayOptions(overlayOptions) {
  if (typeof overlayOptions === "object") {
    for (const property of ["errors", "warnings", "runtimeErrors"]) {
      const value =
        overlayOptions[/** @type {keyof OverlayOptions} */ (property)];

      if (typeof value === "string") {
        const filterFunctionString = decodeURIComponent(value);

        /** @type {EXPECTED_ANY} */ (overlayOptions)[property] =
          // eslint-disable-next-line no-new-func
          new Function(
            "message",
            `var callback = ${filterFunctionString}
        return callback(message)`,
          );
      }
    }
  }
}

setLogLevel(options.logging);

// The six names `apply` and `connect` replaced. Still read, still folded into
// the two that replaced them, and gone in the next major release.
//
// TODO in the next major release remove this and `LEGACY_OPTIONS`.
const LEGACY_OPTIONS = [
  "hot",
  "liveReload",
  "reload",
  "autoConnect",
  "reconnect",
  "timeout",
];

// The three of them this package's own query offered before `apply` and
// `connect`, which are the ones a warning is owed for.
const OWN_LEGACY_OPTIONS = ["reload", "autoConnect", "timeout"];

/**
 * Was it set at all, and if so is it anything but `"false"`? The reading every
 * boolean on this query has always had.
 * @param {string | undefined} value the raw value
 * @param {boolean} fallback what it means when it was not set
 * @returns {boolean} what it says
 */
function legacyBoolean(value, fallback) {
  return value === undefined ? fallback : value !== "false";
}

/**
 * Read the deprecated spellings and fold them into the options that replaced
 * them. The new spelling wins when both are given, so a migration that sets it
 * and leaves the old one behind is not silently ignored.
 * @param {Record<string, string>} overrides parsed query-string overrides
 * @returns {void}
 */
function foldLegacyOptions(overrides) {
  // webpack-dev-server's query spelled it this way, and an entry written by
  // hand for that server still does.
  const devServerSpelling =
    overrides["live-reload"] !== undefined &&
    overrides.liveReload === undefined;

  if (devServerSpelling) {
    overrides.liveReload = overrides["live-reload"];
  }

  const used = LEGACY_OPTIONS.filter((name) => overrides[name] !== undefined);

  if (used.length === 0) {
    return;
  }

  // Said only of the names this client's own query ever offered. `hot`,
  // `liveReload` and `reconnect` arrive from entries written for
  // webpack-dev-server's — what webpack's guide shows for wiring that server's
  // client by hand — and are read as they always were, without a word.
  const deprecated = used.filter(
    (name) => OWN_LEGACY_OPTIONS.indexOf(name) !== -1,
  );

  if (deprecated.length > 0) {
    log.warn(
      `${deprecated.join(", ")} ${deprecated.length === 1 ? "is" : "are"} deprecated and will be removed in the next major release. Use 'apply' and 'connect' instead.`,
    );
  }

  if (overrides.apply === undefined) {
    // `hot` decided whether an update was applied in place; `reload` what
    // happened when it could not be; `liveReload` what happened instead when
    // `hot` was off. Four of their eight combinations differed, which is what
    // the four modes are.
    //
    // webpack-dev-server's client read `hot` as off unless the query said
    // otherwise, so its spelling is read its way: `?live-reload=true` alone
    // is live reload.
    const hot = legacyBoolean(overrides.hot, !devServerSpelling);

    // `hot=only` is webpack-dev-server's own: apply in place, never reload.
    options.apply = hot
      ? overrides.hot !== "only" && legacyBoolean(overrides.reload, true)
        ? "hmr"
        : "hmr-only"
      : legacyBoolean(overrides.liveReload, true)
        ? "reload"
        : "nothing";
  }

  if (overrides.connect === undefined) {
    if (!legacyBoolean(overrides.autoConnect, true)) {
      options.connect = false;
    } else {
      const retries = Number(overrides.reconnect);
      const timeout = Number(overrides.timeout);

      options.connect = {
        ...(overrides.reconnect !== undefined && retries >= 0
          ? { retries }
          : {}),
        ...(overrides.timeout !== undefined && timeout > 0 ? { timeout } : {}),
      };
    }
  }
}

/** @type {ApplyMode[]} */
const APPLY_MODES = ["hmr", "hmr-only", "reload", "nothing"];

/**
 * One of the four modes, or nothing when the value is not one of them.
 * `"false"` is taken as `"nothing"`, which is what the three booleans this
 * replaced meant when they were all turned off.
 * @param {string} value a value from the entry query or the page's url
 * @returns {ApplyMode | undefined} the mode, when it is one
 */
function readApplyMode(value) {
  if (value === "false") {
    return "nothing";
  }

  // `indexOf` rather than `includes`: this file is compiled to ES5 and sticks
  // to ES5 runtime APIs.
  return APPLY_MODES.indexOf(/** @type {ApplyMode} */ (value)) === -1
    ? undefined
    : /** @type {ApplyMode} */ (value);
}

/**
 * What one of the page's own url parameters asks for, which is how a single
 * tab opts out of what the rest of the project is configured for —
 * `?webpack-dev-middleware-apply=nothing` to stop a page reloading under you
 * while you work in it, for instance, or `=false` for the same thing.
 * `urlPrefix` names them, so a server built on this middleware can name them
 * after itself.
 *
 * The parameter is the option, spelled the one way the option is spelled.
 * @param {string} setting which option the page may have something to say about
 * @returns {string | undefined} the value the page gave it, when it gave one
 */
function urlOverride(setting) {
  // Parsed rather than searched for as text: `?note=…-apply=false` carries
  // the words without being the parameter. The name is compared
  // case-insensitively on both sides, so a `urlPrefix` with capitals in it
  // works as written.
  const wanted = `${options.urlPrefix}-${setting}`.toLowerCase();
  // Nowhere this runs is without a url, but nothing here needs one either: an
  // empty query asks for nothing.
  const search =
    typeof self === "undefined" || !self.location ? "" : self.location.search;
  const parameters = parseQuery(search);
  const names = Object.keys(parameters);

  for (let index = 0; index < names.length; index++) {
    if (names[index].toLowerCase() === wanted) {
      return parameters[names[index]].toLowerCase();
    }
  }

  return undefined;
}

/**
 * What a build should do to this page: what `apply` was set to, unless the
 * page's own url asks for something else.
 * @returns {ApplyMode} the mode in force for this page
 */
function applyMode() {
  const override = urlOverride("apply");

  return (override && readApplyMode(override)) || legacyUrlMode(options.apply);
}

/**
 * The two parameters that `apply` replaced, which a page's url could already
 * use to turn one half of a build's response off — `?<prefix>-hot=false` for
 * hot module replacement, `?<prefix>-live-reload=false` for the reload it
 * falls back to. They narrow the mode in force rather than replace it, as
 * they always did, so `hot=false` on a page set to `hmr` leaves the reload.
 *
 * TODO in the next major release remove this, and the two names it reads.
 * @param {ApplyMode} mode the mode in force before the url is asked
 * @returns {ApplyMode} that mode with whatever the url turned off taken away
 */
function legacyUrlMode(mode) {
  let hmr = mode === "hmr" || mode === "hmr-only";
  let reload = mode === "hmr" || mode === "reload";

  if (urlOverride("hot") === "false") {
    hmr = false;
  }

  if (urlOverride("live-reload") === "false") {
    reload = false;
  }

  if (hmr) {
    return reload ? "hmr" : "hmr-only";
  }

  return reload ? "reload" : "nothing";
}

/**
 * @param {Record<string, string>} overrides parsed query-string overrides
 */
function setOverrides(overrides) {
  if (overrides.logging) {
    // A level, or a json object carrying the level and the name to label
    // messages with — the same two shapes the other options take.
    let logging = overrides.logging;
    let parsed;

    try {
      parsed = JSON.parse(logging);
    } catch {
      // Not json, so it is the level it looks like.
    }

    // Only an object is the second shape. `JSON.parse` also accepts a bare
    // number, boolean or quoted string, and a level is none of those — asking
    // what came back rather than what the text started with also means
    // leading whitespace does not hide it.
    if (parsed && typeof parsed === "object") {
      logging = parsed.level;

      if (parsed.name) {
        options.loggerName = parsed.name;
      }
    }

    if (logging) {
      options.logging = /** @type {LogLevel} */ (logging);
    }
  }
  // Before anything else is read, so whatever reading the rest has to say —
  // a deprecated name, say — is labelled and leveled as the entry asked.
  setLogName(options.loggerName);
  setLogLevel(options.logging);
  // TODO in the next major release remove this, and the six names it reads.
  foldLegacyOptions(overrides);
  if (overrides.transport === "sse" || overrides.transport === "ws") {
    options.transport = overrides.transport;
  }
  // Where the page connects, which may be an absolute url rather than a path
  // when the endpoint is on another origin. A json object says the parts that
  // differ and leaves the rest to be resolved against the page, which is the
  // only place the rest is known — behind a proxy, on another host, or on a
  // socket listening on a port of its own.
  // The parts of the url as parameters of their own, the way
  // webpack-dev-server's query has always carried them — so an entry written
  // by hand for that server still connects where it says. Read as a path in
  // parts, which resolves what they leave out against the page; a `path` given
  // as well says it all and wins.
  if (!overrides.path) {
    /** @type {Record<string, string>} */
    const parts = {};

    for (const name of [
      "protocol",
      "hostname",
      "port",
      "pathname",
      "username",
      "password",
    ]) {
      if (overrides[name]) {
        parts[name] = overrides[name];
      }
    }

    if (Object.keys(parts).length > 0) {
      overrides.path = JSON.stringify(parts);
    }
  }
  if (overrides.path) {
    let parsed;

    try {
      parsed = JSON.parse(overrides.path);
    } catch {
      // Not json, so it is the path it looks like.
    }

    // Only an object is the parts form. `JSON.parse` also accepts a bare
    // number, boolean or quoted string, none of which is a path — asking what
    // came back rather than what the text started with also means leading
    // whitespace does not hide it.
    const spec = parsed && typeof parsed === "object" ? parsed : undefined;

    // The transport is read before this, so the url is resolved onto the
    // scheme the transport it is for actually connects over.
    options.path = spec
      ? resolveSocketUrl(spec, DEFAULT_PATH, options.transport)
      : overrides.path;
  }
  if (overrides.token) options.token = overrides.token;
  if (overrides.connect) {
    // A boolean or a JSON object, the same two shapes `overlay` takes.
    try {
      options.connect = JSON.parse(overrides.connect);
    } catch {
      options.connect = overrides.connect !== "false";
    }

    if (typeof options.connect === "object" && options.connect !== null) {
      const { retries, timeout } = options.connect;

      // A non-numeric timeout would make the watchdog fire in a loop (`NaN`
      // never compares greater), and a negative retry count is not a count;
      // either one is dropped rather than applied.
      options.connect = {
        ...(typeof retries === "number" && retries >= 0 ? { retries } : {}),
        ...(typeof timeout === "number" && timeout > 0 ? { timeout } : {}),
      };
    }
  }
  if (overrides.overlay) {
    // Same value shape as webpack-dev-server's `client.overlay`: a boolean or
    // a JSON object with `errors`, `warnings`, `runtimeErrors` (booleans or
    // encoded filter functions) and `trustedTypesPolicyName`.
    try {
      options.overlay = JSON.parse(overrides.overlay);
    } catch {
      options.overlay = overrides.overlay !== "false";
    }

    // Fill in default "true" params for partially-specified objects.
    if (typeof options.overlay === "object") {
      options.overlay = {
        errors: true,
        warnings: true,
        runtimeErrors: true,
        ...options.overlay,
      };

      decodeOverlayOptions(options.overlay);
    }
  }
  if (overrides.apply) {
    const mode = readApplyMode(overrides.apply);

    if (mode) {
      options.apply = mode;
    }
  }
  if (overrides.urlPrefix) options.urlPrefix = overrides.urlPrefix;
  if (overrides.name) {
    options.name = overrides.name;
  }

  if (overrides.progress) {
    // Same values as webpack-dev-server's `client.progress`, so the shape it
    // puts in this query needs no translating.
    options.progress =
      overrides.progress === "linear" || overrides.progress === "circular"
        ? overrides.progress
        : overrides.progress !== "false";
  }

  if (
    overrides.dynamicPublicPath &&
    overrides.dynamicPublicPath !== "false" &&
    // Only a path can be prefixed. An endpoint said in full — as a url, or as
    // parts resolved into one just above — already says where it is, and
    // putting the bundle's public path in front of it would name somewhere
    // that does not exist.
    !/^[a-z][\w+.-]*:/i.test(options.path)
  ) {
    // `path` is appended like a filename (no leading slash); the public path
    // itself is not normalized.
    options.path = __webpack_public_path__ + options.path.replace(/^\//, "");
  }

  setLogName(options.loggerName);
  setLogLevel(options.logging);
}

/**
 * @typedef {(event: { data: string }) => void} MessageListener
 */

/**
 * The transport the page speaks. A custom one injected by webpack-dev-server
 * wins over both built-ins, which is what `client.webSocketTransport` has
 * always done; a module exporting it as `default` is unwrapped.
 * @returns {import("./clients/createSocket.js").CommunicationClientConstructor} client constructor
 */
function getClient() {
  if (typeof __webpack_dev_server_client__ !== "undefined") {
    const injected = /** @type {EXPECTED_ANY} */ (
      __webpack_dev_server_client__
    );

    return typeof injected.default === "undefined"
      ? injected
      : injected.default;
  }

  return options.transport === "ws" ? WebSocketClient : EventSourceClient;
}

/**
 * @returns {ReturnType<typeof createSocket>} a socket on the current options
 */
function createClientSocket() {
  return createSocket(
    getClient(),
    withToken(/** @type {string} */ (options.path), options.token),
    {
      ...socketOptions(options),
      onDisconnect: () => {
        // Said once per outage, at the moment the connection is lost — the
        // symmetry of `connected`, and what webpack-dev-server's client has
        // always printed here. Without it a stopped server leaves a page that
        // looks live and a console that never says otherwise.
        log.info("Disconnected!");

        if (reporter) {
          reporter.clearBuildProblems();
        }

        sendMessage("Close");
      },
    },
  );
}

const WRAPPER_KEY = "__wdmEventSourceWrapper";

/**
 * @returns {ReturnType<typeof createClientSocket>} cached socket for this path
 */
function getEventSourceWrapper() {
  const path = /** @type {string} */ (options.path);
  // `self`, not `window`: the same object in a page, and the only one in a
  // worker, where this client also runs.
  if (!self[WRAPPER_KEY]) {
    self[WRAPPER_KEY] = {};
  }
  if (!self[WRAPPER_KEY][path]) {
    // Cache the socket so multiple entries on the same page sharing the same
    // `options.path` reuse a single connection.
    self[WRAPPER_KEY][path] = createClientSocket();
  }
  return self[WRAPPER_KEY][path];
}

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/** @typedef {{ name?: string, errors: string[], warnings: string[], hash: string, time?: number, action?: string, file?: string, percent?: number, message?: string }} HMRPayload */

/**
 * @returns {{
 * cleanProblemsCache: (name: string) => void,
 * clearBuildProblems: () => void,
 * clearRuntimeProblems: () => void,
 * problems: (type: "errors" | "warnings", obj: HMRPayload) => boolean,
 * success: (obj?: HMRPayload) => void,
 * useCustomOverlay: (customOverlay: EXPECTED_ANY) => void,
 * }} reporter
 */
function createReporter() {
  /** @type {EXPECTED_ANY} */
  let overlay;
  if (typeof document !== "undefined" && options.overlay) {
    // Same mapping as webpack-dev-server's createOverlay call, extended with
    // the webpack-dev-middleware-specific keys.
    overlay = configureOverlay(
      typeof options.overlay === "object"
        ? {
            catchRuntimeError: options.overlay.runtimeErrors,
            trustedTypesPolicyName: options.overlay.trustedTypesPolicyName,
            ansiColors: options.overlay.ansiColors,
            overlayStyles: options.overlay.styles,
            openEditorEndpoint: options.overlay.openEditorEndpoint,
            paginate: options.overlay.paginate,
            id: options.overlay.id,
          }
        : {
            catchRuntimeError: options.overlay,
          },
    );
  }

  // Console de-duplication cache, keyed per bundle name and type so interleaved
  // multi-compiler payloads do not defeat it. A null-prototype object rather
  // than a `Map`, which an ES5 browser does not have.
  /** @type {Record<string, string>} */
  const previousProblems = Object.create(null);

  // Live problems per compilation name. A multi-compiler publishes one event
  // per bundle; a success from one bundle must not wipe another bundle's
  // still-valid errors from the overlay.
  /** @type {Record<string, { errors: string[], warnings: string[] }>} */
  const problemsByName = Object.create(null);

  /**
   * Resolve the show/hide/filter setting for a problem type. Same resolution
   * as webpack-dev-server: a boolean overlay applies to both types; an object
   * carries a boolean or a filter function per type.
   * @param {"errors" | "warnings"} type problem type
   * @param {string[]} problems problems of one bundle
   * @returns {string[]} the problems the overlay should show
   */
  const filterForOverlay = (type, problems) => {
    const setting =
      typeof options.overlay === "boolean"
        ? options.overlay
        : options.overlay && options.overlay[type];

    if (!setting) {
      return [];
    }

    return typeof setting === "function"
      ? problems.filter((message) => setting(message))
      : problems;
  };

  /**
   * Render the union of every bundle's live problems, or clear the overlay
   * when nothing is left.
   * @returns {boolean} true when nothing is shown
   */
  const renderOverlay = () => {
    if (!overlay) {
      return true;
    }

    /** @type {string[]} */
    const errors = [];
    /** @type {string[]} */
    const warnings = [];

    for (const name of Object.keys(problemsByName)) {
      const entry = problemsByName[name];

      errors.push(...filterForOverlay("errors", entry.errors));
      warnings.push(...filterForOverlay("warnings", entry.warnings));
    }

    if (errors.length > 0) {
      overlay.showProblems("errors", errors);
      return false;
    }

    if (warnings.length > 0) {
      overlay.showProblems("warnings", warnings);
      return false;
    }

    // Clear only this client's build problems — other clients sharing the
    // overlay keep theirs, and runtime errors are not this event's to judge: a
    // build that succeeded says nothing about an error the page threw on its
    // own. Dropping them here dismissed an overlay raised milliseconds earlier
    // by an entry that threw while it was still evaluating, because the
    // handshake's catch-up sync arrives right behind it (webpack-dev-server
    // #5024). A rebuild clears them instead, from `building` below.
    overlay.clear("");
    return true;
  };

  /**
   * @param {"errors" | "warnings"} type problem type
   * @param {HMRPayload} obj payload
   */
  const logProblems = (type, obj) => {
    const cacheKey = `${obj.name || ""}|${type}`;
    const newProblems = obj[type].map(stripAnsi).join("\n");
    if (previousProblems[cacheKey] === newProblems) {
      return;
    }
    previousProblems[cacheKey] = newProblems;

    const name = obj.name ? `'${obj.name}' ` : "";
    const title = `bundle ${name}has ${obj[type].length} ${type}`;
    if (type === "errors") {
      log.error(title);
      log.error(newProblems);
    } else {
      log.warn(title);
      log.warn(newProblems);
    }
  };

  return {
    cleanProblemsCache(name) {
      // Scoped to one bundle so a sibling's unchanged problems do not re-log.
      delete previousProblems[`${name}|errors`];
      delete previousProblems[`${name}|warnings`];
    },
    problems(type, obj) {
      logProblems(type, obj);
      problemsByName[obj.name || ""] = {
        errors: obj.errors || [],
        warnings: obj.warnings || [],
      };
      return renderOverlay();
    },
    success(obj) {
      delete problemsByName[(obj && obj.name) || ""];
      renderOverlay();
    },
    clearBuildProblems() {
      // The server is gone, so what it last said about the build is stale: an
      // overlay left up would keep showing errors nothing can fix from here.
      // Forgotten rather than just hidden, so the catch-up a reconnection is
      // sent starts from nothing — it re-reports whatever is still wrong, in
      // the console as well as the overlay.
      for (const name of Object.keys(problemsByName)) {
        delete problemsByName[name];
      }

      for (const key of Object.keys(previousProblems)) {
        delete previousProblems[key];
      }

      // Build problems only. A runtime error is the page's own, and a lost
      // connection says nothing about whether it is still true.
      renderOverlay();
    },
    clearRuntimeProblems() {
      // No overlay configured, or a custom one that does not take sources.
      if (!overlay || !overlay.clear) {
        return;
      }

      overlay.clear("runtime");
    },
    useCustomOverlay(customOverlay) {
      overlay = customOverlay;
    },
  };
}

// The reporter is a singleton on the page so that, when multiple bundles
// include the client, errors are reported once but all clients receive them.
const REPORTER_KEY = "__webpack_dev_middleware_hot_reporter__";
/** @type {((obj: HMRPayload) => void) | undefined} */
let customHandler;
/** @type {((obj: HMRPayload) => void) | undefined} */
let subscribeAllHandler;

/**
 * @param {HMRPayload} obj payload
 */
function processMessage(obj) {
  switch (obj.action) {
    case "building": {
      log.info(
        `bundle ${obj.name ? `'${obj.name}' ` : ""}rebuilding${
          obj.file ? ` (${obj.file} changed)` : ""
        }`,
      );
      // A rebuild replaces the code a runtime error came from, so the error
      // stops being worth showing — unlike a build that merely succeeded,
      // which says nothing about it. Not scoped to this client's bundle: a
      // runtime error is the page's, not one compilation's.
      if (reporter) {
        reporter.clearRuntimeProblems();
      }
      if (options.progress && typeof document !== "undefined") {
        // Named, so the badge stays until every compilation that started has
        // reported back — a sibling finishing is not this one finishing.
        indicator.show(
          obj.file ? `Rebuilding… (${obj.file})` : undefined,
          undefined,
          obj.name || "",
        );
      }
      sendMessage("Invalid");
      break;
    }
    case "error": {
      // Something the server decided about this client, rather than about a
      // build: refused for where it connected from, turned away by a policy
      // the server applies and this middleware does not. The server knows why
      // and the page does not, so what it says is logged as it was given —
      // the alternative is a connection that closes with no explanation
      // anywhere the developer is looking.
      const message = obj.message || "The server refused the connection.";

      log.error(message);
      sendMessage("Error", message);
      break;
    }
    case "reload": {
      // The server asking for the page outright, for a change no compilation
      // knows about — a file served from disk, say. Not a build, so `hot` and
      // `liveReload` have no say in it; the page is stale either way.
      log.info(
        obj.file
          ? `"${obj.file}" changed. Reloading...`
          : "Reloading, as the server asked...",
      );
      sendMessage("Reload", obj.file);
      reloadPage();
      break;
    }
    case "progress": {
      // Reported rather than shown: a progress payload carries no name, so it
      // cannot say whose build it is, and in a multi-compiler build one
      // compilation's progress arrives while a sibling has already finished.
      if (options.progress && typeof document !== "undefined") {
        indicator.update(
          `Rebuilding… ${obj.percent}%${obj.message ? ` (${obj.message})` : ""}`,
          obj.percent,
        );
      }
      sendMessage("Progress", obj);
      break;
    }
    case "built":
    case "sync": {
      if (options.progress && typeof document !== "undefined") {
        indicator.hide(obj.name || "");
      }
      if (obj.action === "built") {
        log.info(
          `bundle ${obj.name ? `'${obj.name}' ` : ""}rebuilt in ${obj.time}ms`,
        );
      }
      // Not a `return`: a sibling bundle's event is still delivered to a
      // `subscribeAll` handler, which is documented to see every message.
      if (obj.name && options.name && obj.name !== options.name) {
        // A sibling's update cannot be applied here, its hash is not this
        // bundle's. Loading the page can: it is the only way a build reaches a
        // page that depends on one it does not own — a server bundle whose
        // output the page is rendered from — and it needs nothing from the
        // payload but that the build produced something.
        if (
          obj.action === "built" &&
          obj.errors.length === 0 &&
          applyMode() === "reload"
        ) {
          log.info("App updated. Reloading...");
          reloadPage();
        }

        break;
      }

      let shouldApply = true;
      // Warnings are reported (and possibly shown in the overlay) but do not
      // block the update, matching webpack-dev-server. A build with errors as
      // well still reports its warnings, before the errors, as that client
      // did: they are as true of a broken build as of a working one.
      if (obj.warnings.length > 0) {
        if (reporter) {
          reporter.problems("warnings", obj);
        }
        sendMessage("Warnings", obj.warnings.map(stripAnsi));
      }
      if (obj.errors.length > 0) {
        if (reporter) reporter.problems("errors", obj);
        shouldApply = false;
        sendMessage("Errors", obj.errors.map(stripAnsi));
      } else if (obj.warnings.length > 0) {
        // Reported above.
      } else {
        if (reporter) {
          reporter.cleanProblemsCache(obj.name || "");
          reporter.success(obj);
        }
        // `built` is a compilation that produced something, `sync` one that
        // had nothing to report — the same distinction webpack-dev-server
        // draws between `Ok` and `StillOk`.
        sendMessage(obj.action === "built" ? "Ok" : "StillOk");
      }
      if (shouldApply) {
        const mode = applyMode();

        if (mode === "hmr" || mode === "hmr-only") {
          // Posted before the update is applied, in the shape
          // webpack-dev-server has always used for this one — a bare string
          // rather than the `{ type, data }` the others carry.
          sendMessage.raw(`webpackHotUpdate${obj.hash}`);
          // `"hmr"` falls back to loading the page when an update cannot be
          // applied; `"hmr-only"` says so and stops.
          applyUpdate(
            obj.hash,
            {
              reload: mode === "hmr",
              runtimeLeftOut:
                options.apply === "reload" || options.apply === "nothing",
            },
            obj.name,
          );
        } else if (
          // Without Hot Module Replacement the new code can only reach the
          // page by loading it again — whenever what the server built is not
          // what the page is running. A `sync` counts too: a page that
          // reconnects after the server restarted is caught up with one, and
          // left alone it would stay on the old code. One whose hash is the
          // page's own changes nothing, whichever action carried it.
          mode === "reload" &&
          obj.hash !== __webpack_hash__
        ) {
          log.info("App updated. Reloading...");
          reloadPage();
        }
      }
      break;
    }
    default: {
      if (customHandler) {
        customHandler(obj);
      }
    }
  }

  if (subscribeAllHandler) {
    subscribeAllHandler(obj);
  }
}

// Path this copy of the client subscribed to, so a `setOptionsAndConnect`
// call after the automatic connect does not add a second listener (every
// message would be processed twice) while a call that changed `path` still
// subscribes to the new connection.
/** @type {string | undefined} */
let subscribedPath;

/**
 * Subscribe the message handler to the shared event source wrapper.
 */
function connect() {
  if (subscribedPath === options.path) {
    return;
  }

  subscribedPath = /** @type {string} */ (options.path);

  getEventSourceWrapper().addMessageListener((event) => {
    if (event.data === "💓") {
      return;
    }
    try {
      processMessage(JSON.parse(event.data));
    } catch (err) {
      log.warn(`Invalid HMR message: ${event.data}\n${err}`);
    }
  });
}

/**
 * @param {Record<string, string>} overrides overrides
 */
export function setOptionsAndConnect(overrides) {
  setOverrides(overrides);
  connect();
}

/**
 * Close the SSE connection for the current path and stop reconnecting. A
 * later `setOptionsAndConnect` call opens a fresh connection.
 */
export function disconnect() {
  const path = /** @type {string} */ (options.path);
  const wrappers = self[WRAPPER_KEY];

  if (wrappers && wrappers[path]) {
    wrappers[path].close();
    delete wrappers[path];
  }

  subscribedPath = undefined;
}

// A module that stands in for this one, re-exporting it, has a query of its
// own and this module has none: whatever was written after the stand-in's
// name is on a different module. It leaves that query here, before it
// requires this one, because by the time its own code runs this module has
// already read its options and connected.
const EMBEDDED_QUERY_KEY = "__webpack_dev_middleware_client_query__";

/**
 * @returns {string} the query this runtime was configured with, from its own request or from the module embedding it
 */
function bootstrapQuery() {
  const own =
    typeof __resourceQuery === "string" && __resourceQuery.length > 0
      ? __resourceQuery
      : "";
  const embedded =
    typeof self === "undefined" ? undefined : self[EMBEDDED_QUERY_KEY];

  // Taken, not read: it was left for this one load, and a later client in the
  // same page, with no query of its own, would otherwise be configured by a
  // stand-in that was never meant for it.
  if (typeof self !== "undefined") {
    delete self[EMBEDDED_QUERY_KEY];
  }

  return own || (typeof embedded === "string" ? embedded : "");
}

// Bootstrap: parse query string overrides, then connect (if enabled).
const query = bootstrapQuery();

if (query.length > 0) {
  setOverrides(parseQuery(query));
}

// `self` is the window in a page and the global scope in a worker, which has
// no `window` at all. Both have the transports, so both can connect; what a
// worker does not have is a document, so the overlay and the indicator are
// left to the page.
if (typeof self !== "undefined") {
  if (typeof document !== "undefined") {
    if (!self[REPORTER_KEY]) {
      self[REPORTER_KEY] = createReporter();
    }
    reporter = self[REPORTER_KEY];

    // `true` keeps the badge this package has always shown.
    indicator.configure(options.progress === "linear" ? "linear" : "circular");
  }

  // Only what the transport in use needs has to exist: asking for a WebSocket
  // on a browser without `EventSource` is fine, and so is the reverse. An
  // injected client speaks for itself, so nothing is required of the browser
  // on its behalf.
  /** @type {string | false} */
  let missing = false;

  if (typeof __webpack_dev_server_client__ === "undefined") {
    missing =
      options.transport === "ws"
        ? typeof WebSocket === "undefined" && "WebSocket"
        : typeof self.EventSource === "undefined" && "EventSource";
  }

  if (missing) {
    log.warn(
      `webpack-dev-middleware's hot client requires ${missing} to work. ` +
        "Include a polyfill if you want to support this browser: " +
        "https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events#Tools",
    );
  } else if (options.connect !== false) {
    connect();
  }
}

/**
 * @param {(obj: HMRPayload) => void} handler called for every incoming HMR message
 */
export function subscribeAll(handler) {
  subscribeAllHandler = handler;
}

/**
 * @param {(obj: HMRPayload) => void} handler called for messages whose `action` is not recognized
 */
export function subscribe(handler) {
  customHandler = handler;
}

/**
 * @param {EXPECTED_ANY} customOverlay replacement for the default error overlay
 */
export function useCustomOverlay(customOverlay) {
  if (reporter) reporter.useCustomOverlay(customOverlay);
}
