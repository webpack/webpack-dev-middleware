/* global __resourceQuery, __webpack_dev_server_client__, __webpack_public_path__ */

// This file is bundled by webpack into a browser bundle, so it is compiled to
// ES5 (see `babel.config.js`) and sticks to ES5 runtime APIs — `EventSource`
// and `Promise` (both required by HMR itself) are the only exceptions.

// TODO in the next major release add an `exports` field to package.json
// (`.`, `./client`, `./client/indicator`, `./client/overlay`, `./package.json`).
// Adding it now is a breaking change: it would hide every other path of the
// package (e.g. `webpack-dev-middleware/dist/...`) from existing users.

import EventSourceClient from "./clients/EventSourceClient.js";
import WebSocketClient from "./clients/WebSocketClient.js";
import createSocket from "./clients/createSocket.js";
import * as indicator from "./indicator.js";
import configureOverlay from "./overlay.js";
import applyUpdate from "./process-update.js";
import { log, setLogLevel } from "./utils/log.js";
import reloadPage from "./utils/reload.js";
import sendMessage from "./utils/send-message.js";
import stripAnsi from "./utils/strip-ansi.js";

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
 * @typedef {object} ClientOptions
 * @property {("sse" | "ws")} transport how the events are carried, matching the server's `hot.transport`
 * @property {string} path endpoint path
 * @property {number} timeout reconnection timeout in milliseconds
 * @property {boolean | OverlayOptions} overlay enable the in-page error overlay (same value shape as webpack-dev-server's `client.overlay`)
 * @property {boolean} hot apply a build through Hot Module Replacement
 * @property {boolean} liveReload reload the page on a build that changed something, when `hot` is off
 * @property {boolean} reload reload the page when HMR cannot apply the update
 * @property {string} urlPrefix prefix of the page-url parameters that turn `hot` and `liveReload` off for one page
 * @property {LogLevel} logging logger level
 * @property {string} name limit updates to this compilation name
 * @property {boolean} autoConnect connect immediately when the entry runs
 * @property {number=} reconnect how many times to reconnect before giving up, unset to use the transport's default
 * @property {boolean | "circular" | "linear"} progress show an indicator while a rebuild is in progress — `true` and `"circular"` a small badge, `"linear"` a thin bar across the top of the viewport
 */

/** @type {ClientOptions} */
const options = {
  transport: "sse",
  path: "/__webpack_hmr",
  timeout: 20 * 1000,
  overlay: true,
  hot: true,
  liveReload: true,
  reload: true,
  urlPrefix: "webpack-dev-middleware",
  logging: "info",
  name: "",
  autoConnect: true,
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
   * @param {string} value raw value
   * @returns {string} decoded value
   */
  const decode = (value) => decodeURIComponent(value.replace(/\+/g, " "));

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

/**
 * Whether one of the page's own url parameters turns a setting off, which is
 * how a single tab opts out of what the rest of the project is configured for
 * — `?webpack-dev-middleware-live-reload=false` to stop a page reloading under
 * you while you work in it, for instance. `urlPrefix` names them, so a server
 * built on this middleware can keep the parameters its users already know.
 * @param {string} setting `hot` or `live-reload`
 * @returns {boolean} whether the page turned it off
 */
function turnedOffByUrl(setting) {
  // Parsed rather than searched for as text: `?note=…-hot=false` carries the
  // words without being the parameter, and `…-hot=falsehood` is not `false`.
  // The name is compared case-insensitively on both sides, so a `urlPrefix`
  // with capitals in it works as written.
  const wanted = `${options.urlPrefix}-${setting}`.toLowerCase();
  // Nowhere this runs is without a url, but nothing here needs one either: an
  // empty query turns nothing off.
  const search =
    typeof self === "undefined" || !self.location ? "" : self.location.search;
  const parameters = parseQuery(search);
  const names = Object.keys(parameters);

  for (let index = 0; index < names.length; index++) {
    if (names[index].toLowerCase() === wanted) {
      return parameters[names[index]].toLowerCase() === "false";
    }
  }

  return false;
}

/**
 * @param {Record<string, string>} overrides parsed query-string overrides
 */
function setOverrides(overrides) {
  if (overrides.autoConnect) {
    options.autoConnect = overrides.autoConnect === "true";
  }
  if (overrides.transport === "sse" || overrides.transport === "ws") {
    options.transport = overrides.transport;
  }
  // webpack-dev-server spells the endpoint `webSocketURL`, and unlike `path`
  // it carries the origin as well, which is what lets the page reach a server
  // on another host.
  if (overrides.webSocketURL) options.path = overrides.webSocketURL;
  if (overrides.path) options.path = overrides.path;
  if (overrides.timeout) {
    const timeout = Number(overrides.timeout);

    // A non-numeric value would make the watchdog fire in a loop (`NaN` never
    // compares greater), so it is ignored rather than applied.
    if (timeout > 0) {
      options.timeout = timeout;
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
  if (overrides.reconnect) {
    const reconnect = Number(overrides.reconnect);

    if (reconnect >= 0) {
      options.reconnect = reconnect;
    }
  }
  if (overrides.hot) options.hot = overrides.hot !== "false";
  // Two different things, and webpack-dev-server spells them the same way:
  // `live-reload` is what happens on a build when `hot` is off, `reload` is
  // what happens when an update was tried and could not be applied.
  if (overrides["live-reload"]) {
    options.liveReload = overrides["live-reload"] !== "false";
  }
  if (overrides.liveReload) {
    options.liveReload = overrides.liveReload !== "false";
  }
  if (overrides.reload) options.reload = overrides.reload !== "false";
  if (overrides.urlPrefix) options.urlPrefix = overrides.urlPrefix;
  if (overrides.logging) {
    options.logging = /** @type {LogLevel} */ (overrides.logging);
  }
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

  if (overrides.dynamicPublicPath && overrides.dynamicPublicPath !== "false") {
    // `path` is appended like a filename (no leading slash); the public path
    // itself is not normalized.
    options.path = __webpack_public_path__ + options.path.replace(/^\//, "");
  }

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
  const isEventSource = options.transport !== "ws";

  return createSocket(getClient(), /** @type {string} */ (options.path), {
    clientOptions: { timeout: options.timeout },
    // Server-Sent Events are retried for as long as the page is open, at the
    // steady interval its watchdog already uses: a dev server is expected to
    // come back, and a tab left open over a restart has to find it again.
    retries: isEventSource ? Infinity : options.reconnect,
    retryDelay: isEventSource
      ? () => /** @type {number} */ (options.timeout)
      : undefined,
    onDisconnect: () => {
      sendMessage("Close");
    },
  });
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
/** @type {ReturnType<typeof createReporter> | undefined} */
let reporter;

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
        break;
      }

      let shouldApply = true;
      if (obj.errors.length > 0) {
        if (reporter) reporter.problems("errors", obj);
        shouldApply = false;
        sendMessage("Errors", obj.errors);
      } else if (obj.warnings.length > 0) {
        // Warnings are reported (and possibly shown in the overlay) but do
        // not block the update, matching webpack-dev-server.
        if (reporter) {
          reporter.problems("warnings", obj);
        }
        sendMessage("Warnings", obj.warnings);
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
        if (options.hot && !turnedOffByUrl("hot")) {
          // Posted before the update is applied, in the shape
          // webpack-dev-server has always used for this one — a bare string
          // rather than the `{ type, data }` the others carry.
          sendMessage.raw(`webpackHotUpdate${obj.hash}`);
          applyUpdate(obj.hash, options, obj.name);
        } else if (
          // Without Hot Module Replacement the new code can only reach the
          // page by loading it again. `sync` is left alone: it reports what
          // the page is already running.
          obj.action === "built" &&
          options.liveReload &&
          !turnedOffByUrl("live-reload")
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

// Bootstrap: parse query string overrides, then connect (if enabled).
if (typeof __resourceQuery === "string" && __resourceQuery.length > 0) {
  setOverrides(parseQuery(__resourceQuery));
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
  } else if (options.autoConnect) {
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
