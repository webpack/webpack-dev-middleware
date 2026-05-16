"use strict";

/* global __resourceQuery, __webpack_public_path__ */

const stripAnsi = require("strip-ansi");

const processUpdate = require("./process-update");

/**
 * @typedef {object} ClientOptions
 * @property {string} path SSE endpoint path
 * @property {number} timeout reconnection timeout in milliseconds
 * @property {boolean} overlay enable the in-page error overlay
 * @property {boolean} reload reload the page when HMR cannot apply the update
 * @property {boolean} log emit informational logs to the console
 * @property {boolean} warn emit warnings to the console
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
  reload: false,
  log: true,
  warn: true,
  name: "",
  autoConnect: true,
  overlayStyles: {},
  overlayWarnings: false,
  ansiColors: {},
};

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
  if (overrides.noInfo && overrides.noInfo !== "false") {
    options.log = false;
  }
  if (overrides.name) {
    options.name = overrides.name;
  }
  if (overrides.quiet && overrides.quiet !== "false") {
    options.log = false;
    options.warn = false;
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
    if (options.log) console.log("[HMR] connected");
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
      if (options.warn) {
        console.warn(`Invalid HMR message: ${event.data}\n${err}`);
      }
    }
  });
}

/**
 * @param {Record<string, string>} overrides overrides
 */
function setOptionsAndConnect(overrides) {
  setOverrides(overrides);
  connect();
}

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/** @typedef {{ name?: string, errors: string[], warnings: string[], hash: string, time?: number, modules?: Record<string, string>, action?: string }} HMRPayload */

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
    overlay = require("./overlay")({
      ansiColors: options.ansiColors,
      overlayStyles: options.overlayStyles,
    });
  }

  /** @type {Record<string, string>} */
  const styles = {
    errors: "color: #ff0000;",
    warnings: "color: #999933;",
  };
  /** @type {string | null} */
  let previousProblems = null;

  /**
   * @param {"errors" | "warnings"} type problem type
   * @param {HMRPayload} obj payload
   */
  const log = (type, obj) => {
    const newProblems = obj[type].map(stripAnsi).join("\n");
    if (previousProblems === newProblems) {
      return;
    }
    previousProblems = newProblems;

    const style = styles[type];
    const name = obj.name ? `'${obj.name}' ` : "";
    const title = `[HMR] bundle ${name}has ${obj[type].length} ${type}`;
    // NOTE: console.warn / console.error print the stack trace which is noise
    // for us; using console.log to keep the message clean.
    if (console.group && console.groupEnd) {
      console.group(`%c${title}`, style);
      console.log(`%c${newProblems}`, style);
      console.groupEnd();
    } else {
      console.log(
        `%c${title}\n\t%c${newProblems.replaceAll("\n", "\n\t")}`,
        `${style}font-weight: bold;`,
        `${style}font-weight: normal;`,
      );
    }
  };

  return {
    cleanProblemsCache() {
      previousProblems = null;
    },
    problems(type, obj) {
      if (options.warn) {
        log(type, obj);
      }
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
      if (options.log) {
        console.log(
          `[HMR] bundle ${obj.name ? `'${obj.name}' ` : ""}rebuilding`,
        );
      }
      break;
    }
    case "built":
    case "sync": {
      if (obj.action === "built" && options.log) {
        console.log(
          `[HMR] bundle ${obj.name ? `'${obj.name}' ` : ""}rebuilt in ${obj.time}ms`,
        );
      }
      if (obj.name && options.name && obj.name !== options.name) {
        return;
      }
      let applyUpdate = true;
      if (obj.errors.length > 0) {
        if (reporter) reporter.problems("errors", obj);
        applyUpdate = false;
      } else if (obj.warnings.length > 0) {
        if (reporter) {
          applyUpdate = reporter.problems("warnings", obj);
        }
      } else if (reporter) {
        reporter.cleanProblemsCache();
        reporter.success();
      }
      if (applyUpdate) {
        processUpdate(obj.hash, obj.modules, options);
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
    console.warn(
      "webpack-dev-middleware's hot client requires EventSource to work. " +
        "Include a polyfill if you want to support this browser: " +
        "https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events#Tools",
    );
  } else if (options.autoConnect) {
    connect();
  }
}

module.exports = {
  /**
   * @param {(obj: HMRPayload) => void} handler called for every incoming HMR message
   */
  subscribeAll(handler) {
    subscribeAllHandler = handler;
  },
  /**
   * @param {(obj: HMRPayload) => void} handler called for messages whose `action` is not recognized
   */
  subscribe(handler) {
    customHandler = handler;
  },
  /**
   * @param {EXPECTED_ANY} customOverlay replacement for the default error overlay
   */
  useCustomOverlay(customOverlay) {
    if (reporter) reporter.useCustomOverlay(customOverlay);
  },
  setOptionsAndConnect,
};
