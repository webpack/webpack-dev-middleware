/* global __resourceQuery, __webpack_public_path__ */

import configureOverlay from "./overlay.js";
import applyUpdate from "./process-update.js";
import { log, setLogLevel } from "./utils/log.js";
import stripAnsi from "./utils/strip-ansi.js";

/** @typedef {import("./utils/log.js").LogLevel} LogLevel */

/**
 * @typedef {object} ClientOptions
 * @property {string} path SSE endpoint path
 * @property {number} timeout reconnection timeout in milliseconds
 * @property {boolean} overlay enable the in-page error overlay
 * @property {boolean} reload reload the page when HMR cannot apply the update
 * @property {LogLevel} logging logger level
 * @property {string} name limit updates to this compilation name
 * @property {boolean} autoConnect connect immediately when the entry runs
 * @property {Record<string, string | number>} overlayStyles overrides for the overlay container CSS
 * @property {boolean} overlayWarnings show warnings in the overlay too
 * @property {Record<string, string | string[]>} ansiColors overrides for ANSI → HTML color mapping
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
  overlayStyles: {},
  overlayWarnings: false,
  ansiColors: {},
};

setLogLevel(options.logging);

/**
 * @param {Record<string, string>} overrides parsed query-string overrides
 */
function setOverrides(overrides) {
  if (overrides.autoConnect) {
    options.autoConnect = overrides.autoConnect === "true";
  }
  if (overrides.path) options.path = overrides.path;
  if (overrides.timeout) options.timeout = Number(overrides.timeout);
  if (overrides.overlay) options.overlay = overrides.overlay !== "false";
  if (overrides.reload) options.reload = overrides.reload !== "false";
  if (overrides.logging) {
    options.logging = /** @type {LogLevel} */ (overrides.logging);
  }
  if (overrides.name) {
    options.name = overrides.name;
  }

  if (overrides.dynamicPublicPath) {
    options.path = __webpack_public_path__ + options.path;
  }

  if (overrides.ansiColors) {
    options.ansiColors = JSON.parse(overrides.ansiColors);
  }
  if (overrides.overlayStyles) {
    options.overlayStyles = JSON.parse(overrides.overlayStyles);
  }

  if (overrides.overlayWarnings) {
    options.overlayWarnings = overrides.overlayWarnings === "true";
  }

  setLogLevel(options.logging);
}

/**
 * @typedef {(event: { data: string }) => void} MessageListener
 */

/**
 * @returns {{ addMessageListener: (fn: MessageListener) => void }} event source wrapper
 */
function createEventSourceWrapper() {
  /** @type {EventSource} */
  let source;
  let lastActivity = Date.now();
  /** @type {MessageListener[]} */
  const listeners = [];
  /** @type {ReturnType<typeof setInterval>} */
  let timer;

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

  const handleDisconnect = () => {
    clearInterval(timer);
    source.close();
    setTimeout(init, /** @type {number} */ (options.timeout));
  };

  /**
   * Open the EventSource connection.
   */
  function init() {
    source = new window.EventSource(/** @type {string} */ (options.path));
    source.addEventListener("open", handleOnline);
    source.addEventListener("error", handleDisconnect);
    source.addEventListener("message", handleMessage);
  }

  init();
  timer = setInterval(
    () => {
      if (Date.now() - lastActivity > /** @type {number} */ (options.timeout)) {
        handleDisconnect();
      }
    },
    /** @type {number} */ (options.timeout) / 2,
  );

  return {
    addMessageListener(fn) {
      listeners.push(fn);
    },
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

/**
 * Subscribe the message handler to the shared event source wrapper.
 */
function connect() {
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

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/** @typedef {{ name?: string, errors: string[], warnings: string[], hash: string, time?: number, action?: string }} HMRPayload */

/**
 * @returns {{
 * cleanProblemsCache: () => void,
 * problems: (type: "errors" | "warnings", obj: HMRPayload) => boolean,
 * success: () => void,
 * useCustomOverlay: (customOverlay: EXPECTED_ANY) => void,
 * }} reporter
 */
function createReporter() {
  /** @type {EXPECTED_ANY} */
  let overlay;
  if (typeof document !== "undefined" && options.overlay) {
    overlay = configureOverlay({
      ansiColors: options.ansiColors,
      overlayStyles: options.overlayStyles,
    });
  }

  /** @type {string | null} */
  let previousProblems = null;

  /**
   * @param {"errors" | "warnings"} type problem type
   * @param {HMRPayload} obj payload
   */
  const logProblems = (type, obj) => {
    const newProblems = obj[type].map(stripAnsi).join("\n");
    if (previousProblems === newProblems) {
      return;
    }
    previousProblems = newProblems;

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
    cleanProblemsCache() {
      previousProblems = null;
    },
    problems(type, obj) {
      logProblems(type, obj);
      if (overlay) {
        if (options.overlayWarnings || type === "errors") {
          overlay.showProblems(type, obj[type]);
          return false;
        }
        overlay.clear();
      }
      return true;
    },
    success() {
      if (overlay) overlay.clear();
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
      log.info(`bundle ${obj.name ? `'${obj.name}' ` : ""}rebuilding`);
      break;
    }
    case "built":
    case "sync": {
      if (obj.action === "built") {
        log.info(
          `bundle ${obj.name ? `'${obj.name}' ` : ""}rebuilt in ${obj.time}ms`,
        );
      }
      if (obj.name && options.name && obj.name !== options.name) {
        return;
      }
      let shouldApply = true;
      if (obj.errors.length > 0) {
        if (reporter) reporter.problems("errors", obj);
        shouldApply = false;
      } else if (obj.warnings.length > 0) {
        if (reporter) {
          shouldApply = reporter.problems("warnings", obj);
        }
      } else if (reporter) {
        reporter.cleanProblemsCache();
        reporter.success();
      }
      if (shouldApply) {
        applyUpdate(obj.hash, options);
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

// Bootstrap: parse query string overrides, then connect (if enabled).
if (typeof __resourceQuery === "string" && __resourceQuery.length > 0) {
  const params = [...new URLSearchParams(__resourceQuery.slice(1))];
  /** @type {Record<string, string>} */
  const overrides = {};
  for (const [key, value] of params) {
    overrides[key] = value;
  }
  setOverrides(overrides);
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
