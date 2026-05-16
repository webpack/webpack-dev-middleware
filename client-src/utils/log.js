"use strict";

// @ts-expect-error -- no published types for this entry point
const logger = require("webpack/lib/logging/runtime");

const LOGGER_NAME = "webpack-dev-middleware";
const DEFAULT_LEVEL = "info";

/** @typedef {false | true | "none" | "error" | "warn" | "info" | "log" | "verbose"} LogLevel */

/**
 * @param {LogLevel} level log level (or `false` for off, `true` for default)
 */
function setLogLevel(level) {
  logger.configureDefaultLogger({ level });
}

setLogLevel(DEFAULT_LEVEL);

const log = logger.getLogger(LOGGER_NAME);

module.exports = { log, setLogLevel };
