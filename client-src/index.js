/* global __resourceQuery, __webpack_public_path__ */

// This file is bundled by webpack into a browser bundle, so it is compiled to
// ES5 (see `babel.config.js`) and sticks to ES5 runtime APIs — `EventSource`
// and `Promise` (both required by HMR itself) are the only exceptions.

// TODO in the next major release add an `exports` field to package.json
// (`.`, `./client`, `./client/indicator`, `./client/overlay`, `./package.json`).
// Adding it now is a breaking change: it would hide every other path of the
// package (e.g. `webpack-dev-middleware/dist/...`) from existing users.

import * as indicator from "./indicator.js";
import configureOverlay from "./overlay.js";
import applyUpdate from "./process-update.js";
import { log, setLogLevel } from "./utils/log.js";
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
 */

/**
 * @typedef {object} ClientOptions
 * @property {string} path SSE endpoint path
 * @property {number} timeout reconnection timeout in milliseconds
 * @property {boolean | OverlayOptions} overlay enable the in-page error overlay (same value shape as webpack-dev-server's `client.overlay`)
 * @property {boolean} reload reload the page when HMR cannot apply the update
 * @property {LogLevel} logging logger level
 * @property {string} name limit updates to this compilation name
 * @property {boolean} autoConnect connect immediately when the entry runs
 * @property {boolean} progress show a small badge while a rebuild is in progress
 */

/** @type {ClientOptions} */
const options = {
  path: "/__webpack_hmr",
  timeout: 20 * 1000,
  overlay: true,
  reload: true,
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
 * @param {Record<string, string>} overrides parsed query-string overrides
 */
function setOverrides(overrides) {
  if (overrides.autoConnect) {
    options.autoConnect = overrides.autoConnect === "true";
  }
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
  if (overrides.reload) options.reload = overrides.reload !== "false";
  if (overrides.logging) {
    options.logging = /** @type {LogLevel} */ (overrides.logging);
  }
  if (overrides.name) {
    options.name = overrides.name;
  }

  if (overrides.progress) {
    options.progress = overrides.progress !== "false";
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
 * @returns {{ addMessageListener: (fn: MessageListener) => void, close: () => void }} event source wrapper
 */
function createEventSourceWrapper() {
  /** @type {EventSource} */
  let source;
  let lastActivity = Date.now();
  /** @type {MessageListener[]} */
  const listeners = [];
  /** @type {ReturnType<typeof setInterval>} */
  let timer;
  /** @type {ReturnType<typeof setTimeout>} */
  let reconnectTimer;
  // Set once the wrapper is closed for good, so an `error` event the
  // EventSource had already queued cannot schedule a reconnection after it.
  let closed = false;

  const handleOnline = () => {
    log.info("connected");
    lastActivity = Date.now();
  };

  /**
   * @param {{ data: string }} event event
   */
  const handleMessage = (event) => {
    lastActivity = Date.now();
    for (const listener of listeners) {
      listener(event);
    }
  };

  /**
   * Close the connection and stop the activity timer without scheduling a
   * reconnection. A reconnection that is already pending is cancelled too, so
   * closing during the reconnect window really is final.
   */
  const close = () => {
    closed = true;
    clearInterval(timer);
    clearTimeout(reconnectTimer);
    source.close();
  };

  /**
   * Open the EventSource connection and (re)start the inactivity watchdog —
   * disconnecting stops the watchdog, so a reconnected source has to bring its
   * own. The disconnect handler belongs to one connection, so it is created
   * here rather than shared between reconnections.
   */
  const init = () => {
    closed = false;

    const handleDisconnect = () => {
      if (closed) {
        return;
      }

      close();
      reconnectTimer = setTimeout(
        init,
        /** @type {number} */ (options.timeout),
      );
    };

    source = new window.EventSource(/** @type {string} */ (options.path));
    source.addEventListener("open", handleOnline);
    source.addEventListener("error", handleDisconnect);
    source.addEventListener("message", handleMessage);

    lastActivity = Date.now();
    clearInterval(timer);
    timer = setInterval(
      () => {
        if (
          Date.now() - lastActivity >
          /** @type {number} */ (options.timeout)
        ) {
          handleDisconnect();
        }
      },
      /** @type {number} */ (options.timeout) / 2,
    );
  };

  init();

  return {
    addMessageListener(fn) {
      listeners.push(fn);
    },
    close,
  };
}

const WRAPPER_KEY = "__wdmEventSourceWrapper";

/**
 * @returns {ReturnType<typeof createEventSourceWrapper>} cached event source wrapper for this path
 */
function getEventSourceWrapper() {
  const path = /** @type {string} */ (options.path);
  if (!window[WRAPPER_KEY]) {
    window[WRAPPER_KEY] = {};
  }
  if (!window[WRAPPER_KEY][path]) {
    // Cache the wrapper so multiple entries on the same page sharing the same
    // `options.path` reuse a single SSE connection.
    window[WRAPPER_KEY][path] = createEventSourceWrapper();
  }
  return window[WRAPPER_KEY][path];
}

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/** @typedef {{ name?: string, errors: string[], warnings: string[], hash: string, time?: number, action?: string, file?: string, percent?: number, message?: string }} HMRPayload */

/**
 * @returns {{
 * cleanProblemsCache: (name: string) => void,
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

    // Clear only this client's problems and the runtime errors — other
    // clients sharing the overlay keep theirs.
    overlay.clear("");
    overlay.clear("runtime");
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

// Name of the build that most recently reported `building` — progress
// payloads carry no name, so they are attributed to it.
let lastBuildingName = "";

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
      if (options.progress && typeof document !== "undefined") {
        lastBuildingName = obj.name || "";
        indicator.show(
          obj.file ? `Rebuilding… (${obj.file})` : undefined,
          undefined,
          lastBuildingName,
        );
      }
      break;
    }
    case "progress": {
      // Progress payloads carry no name — attribute them to the build that
      // most recently reported `building`.
      if (options.progress && typeof document !== "undefined") {
        indicator.show(
          `Rebuilding… ${obj.percent}%${obj.message ? ` (${obj.message})` : ""}`,
          obj.percent,
          lastBuildingName,
        );
      }
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
      } else if (obj.warnings.length > 0) {
        // Warnings are reported (and possibly shown in the overlay) but do
        // not block the update, matching webpack-dev-server.
        if (reporter) {
          reporter.problems("warnings", obj);
        }
      } else if (reporter) {
        reporter.cleanProblemsCache(obj.name || "");
        reporter.success(obj);
      }
      if (shouldApply) {
        applyUpdate(obj.hash, options, obj.name);
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
  const wrappers = window[WRAPPER_KEY];

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

if (typeof window !== "undefined") {
  if (!window[REPORTER_KEY]) {
    window[REPORTER_KEY] = createReporter();
  }
  reporter = window[REPORTER_KEY];

  if (typeof window.EventSource === "undefined") {
    log.warn(
      "webpack-dev-middleware's hot client requires EventSource to work. " +
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
