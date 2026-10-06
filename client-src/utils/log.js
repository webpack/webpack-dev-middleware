// @ts-expect-error -- no published types for this entry point
import logger from "webpack/lib/logging/runtime.js";

const DEFAULT_NAME = "webpack-dev-middleware";
const DEFAULT_LEVEL = "info";

/** @typedef {false | true | "none" | "error" | "warn" | "info" | "log" | "verbose"} LogLevel */

/**
 * @param {LogLevel} level log level (or `false` for off, `true` for default)
 */
export function setLogLevel(level) {
  logger.configureDefaultLogger({ level });
}

setLogLevel(DEFAULT_LEVEL);

// What every message is labelled with in the console. A package embedding this
// runtime is the package the developer installed and the one they would report
// a problem to, so it says its own name rather than this one — the same reason
// the overlay's element id is settable.
let rawLog = logger.getLogger(DEFAULT_NAME);

/**
 * @param {string=} name what to label messages with
 */
export function setLogName(name) {
  rawLog = logger.getLogger(name || DEFAULT_NAME);
}

/**
 * Guard a logger method: under a `require-trusted-types-for 'script'`
 * Content Security Policy, tapable (bundled through webpack's logging
 * runtime) cannot compile its hooks — `new Function` throws an EvalError on
 * the first log call. Swallowing it keeps HMR fully functional with logging
 * off instead of breaking whatever listener happened to log.
 * @param {string} method logger method name
 * @returns {(...args: unknown[]) => void} guarded method
 */
function guarded(method) {
  return (...args) => {
    try {
      rawLog[method](...args);
    } catch {
      // Logging is unavailable (e.g. Trusted Types enforcement).
    }
  };
}

export const log = {
  error: guarded("error"),
  warn: guarded("warn"),
  info: guarded("info"),
  log: guarded("log"),
  groupCollapsed: guarded("groupCollapsed"),
  groupEnd: guarded("groupEnd"),
};
