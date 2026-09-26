/** @typedef {false | true | "none" | "error" | "warn" | "info" | "log" | "verbose"} LogLevel */
/**
 * @param {LogLevel} level log level (or `false` for off, `true` for default)
 */
export function setLogLevel(level: LogLevel): void;
export namespace log {
  let error: (...args: unknown[]) => void;
  let warn: (...args: unknown[]) => void;
  let info: (...args: unknown[]) => void;
  let log: (...args: unknown[]) => void;
  let groupCollapsed: (...args: unknown[]) => void;
  let groupEnd: (...args: unknown[]) => void;
}
export type LogLevel =
  false | true | "none" | "error" | "warn" | "info" | "log" | "verbose";
