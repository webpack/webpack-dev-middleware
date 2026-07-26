// @ts-expect-error -- no published types for this entry point
import logger from "webpack/lib/logging/runtime.js";

const LOGGER_NAME = "webpack-dev-middleware";
const DEFAULT_LEVEL = "info";

/** @typedef {false | true | "none" | "error" | "warn" | "info" | "log" | "verbose"} LogLevel */

/**
 * @param {LogLevel} level log level (or `false` for off, `true` for default)
 */
export function setLogLevel(level) {
  logger.configureDefaultLogger({ level });
}

setLogLevel(DEFAULT_LEVEL);

const rawLog = logger.getLogger(LOGGER_NAME);

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
