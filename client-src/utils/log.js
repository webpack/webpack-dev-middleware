/* eslint-disable no-console -- this module is the console logger */
// A self-contained level-gated console logger. webpack's logging runtime is
// deliberately not used: it pulls tapable into the bundle, whose hook
// compiler calls `new Function` — which throws under a
// `require-trusted-types-for 'script'` Content Security Policy.

const LOG_PREFIX = "[webpack-dev-middleware]";

/** @typedef {false | true | "none" | "error" | "warn" | "info" | "log" | "verbose"} LogLevel */

const LEVELS = ["none", "error", "warn", "info", "log", "verbose"];

const DEFAULT_LEVEL = "info";

let currentLevel = DEFAULT_LEVEL;

/**
 * @param {LogLevel} level log level (or `false` for off, `true` for "log")
 */
export function setLogLevel(level) {
  if (level === false) {
    currentLevel = "none";
  } else if (level === true) {
    currentLevel = "log";
  } else if (LEVELS.includes(level)) {
    currentLevel = level;
  }
}

/**
 * @param {string} level level of the message
 * @returns {boolean} true when the current level shows the message
 */
function enabled(level) {
  return LEVELS.indexOf(currentLevel) >= LEVELS.indexOf(level);
}

/**
 * Prefix like webpack's logger: merged into the first argument when it is a
 * string, passed separately otherwise (e.g. Error objects).
 * @param {unknown[]} args arguments
 * @returns {unknown[]} prefixed arguments
 */
function prefixed(args) {
  return typeof args[0] === "string"
    ? [`${LOG_PREFIX} ${args[0]}`, ...args.slice(1)]
    : [LOG_PREFIX, ...args];
}

export const log = {
  /**
   * @param {...unknown} args arguments
   */
  error(...args) {
    if (enabled("error")) console.error(...prefixed(args));
  },
  /**
   * @param {...unknown} args arguments
   */
  warn(...args) {
    if (enabled("warn")) console.warn(...prefixed(args));
  },
  /**
   * @param {...unknown} args arguments
   */
  info(...args) {
    if (enabled("info")) console.info(...prefixed(args));
  },
  /**
   * @param {...unknown} args arguments
   */
  log(...args) {
    if (enabled("log")) console.log(...prefixed(args));
  },
  /**
   * @param {...unknown} args arguments
   */
  groupCollapsed(...args) {
    if (enabled("log")) console.groupCollapsed(...prefixed(args));
  },
  groupEnd() {
    if (enabled("log")) console.groupEnd();
  },
};
