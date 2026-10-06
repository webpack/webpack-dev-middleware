// webpack's own console logger. The one thing left out is
// `webpack/lib/logging/runtime.js`, which is a few lines of glue around these
// two and a `tapable` hook for plugins to intercept messages with: the client
// has no plugins, and `tapable` asks for `util` and compiles its hooks with
// `new Function`. In a `universal` or `["web", "node"]` build that put a
// `createRequire` of a node builtin in the page's bundle, which a page cannot
// call, and a `require-trusted-types-for 'script'` policy refused the hooks.

// @ts-expect-error -- no published types for these entry points
import { Logger } from "webpack/lib/logging/Logger.js";
// @ts-expect-error -- no published types for these entry points
import createConsoleLogger from "webpack/lib/logging/createConsoleLogger.js";

const DEFAULT_NAME = "webpack-dev-middleware";
const DEFAULT_LEVEL = "info";

/** @typedef {false | true | "none" | "error" | "warn" | "info" | "log" | "verbose"} LogLevel */

/** @type {{ level: LogLevel, debug: boolean, console: Console }} */
const options = { level: DEFAULT_LEVEL, debug: false, console };
let consoleLogger = createConsoleLogger(options);

/**
 * @param {LogLevel} level log level (or `false` for off, `true` for default)
 */
export function setLogLevel(level) {
  options.level = level;
  consoleLogger = createConsoleLogger(options);
}

// What every message is labelled with in the console. A package embedding this
// runtime is the package the developer installed and the one they would report
// a problem to, so it says its own name rather than this one.
let loggerName = DEFAULT_NAME;

/**
 * @param {string=} name what to label messages with
 */
export function setLogName(name) {
  loggerName = name || DEFAULT_NAME;
}

const rawLog = new Logger(
  /**
   * @param {string} type what kind of message it is
   * @param {unknown[]} args what was logged
   */
  (type, args) => {
    consoleLogger(loggerName, type, args);
  },
);

export const log = {
  /**
   * @param {...unknown} args what to log
   */
  error: (...args) => {
    rawLog.error(...args);
  },
  /**
   * @param {...unknown} args what to log
   */
  warn: (...args) => {
    rawLog.warn(...args);
  },
  /**
   * @param {...unknown} args what to log
   */
  info: (...args) => {
    rawLog.info(...args);
  },
  /**
   * @param {...unknown} args what to log
   */
  log: (...args) => {
    rawLog.log(...args);
  },
  /**
   * @param {...unknown} args what to log
   */
  groupCollapsed: (...args) => {
    rawLog.groupCollapsed(...args);
  },
  groupEnd: () => {
    rawLog.groupEnd();
  },
};
