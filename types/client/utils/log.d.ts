/**
 * @param {LogLevel} level log level (or `false` for off, `true` for default)
 */
export function setLogLevel(level: LogLevel): void;
/**
 * @param {string=} name what to label messages with
 */
export function setLogName(name?: string | undefined): void;
export namespace log {
  function error(...args: unknown[]): void;
  function warn(...args: unknown[]): void;
  function info(...args: unknown[]): void;
  function log(...args: unknown[]): void;
  function groupCollapsed(...args: unknown[]): void;
  function groupEnd(): void;
}
export type LogLevel =
  false | true | "none" | "error" | "warn" | "info" | "log" | "verbose";
