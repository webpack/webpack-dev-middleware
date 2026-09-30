/** @typedef {any} EXPECTED_ANY */
/**
 * One of webpack's errors or warnings, as `stats.toJson()` reports it. Only
 * the fields that say something about where and what; anything else on a
 * `StatsError` is ignored.
 * @typedef {object} Problem
 * @property {string=} file the file the problem is in
 * @property {string=} moduleName the module's request, loaders and all
 * @property {string=} loc line and column within the module
 * @property {string=} message what went wrong
 * @property {(string[] | EXPECTED_ANY)=} stack frames webpack attached, when it did
 */
/**
 * Where a problem happened, as one line.
 *
 * A module processed by loaders reports its whole request as `moduleName`
 * (`babel-loader!./src/app.js`), which reads as noise where the file is what
 * matters — so the file comes first and the request follows it in brackets.
 * Empty when webpack said neither, rather than a line with nothing on it.
 * @param {string | Problem} item a problem, or a message on its own
 * @returns {string} the location, or an empty string
 */
export function problemLocation(item: string | Problem): string;
/**
 * What a problem says, with any stack webpack attached under it.
 * @param {string | Problem} item a problem, or a message on its own
 * @returns {string} the message
 */
export function problemBody(item: string | Problem): string;
/**
 * A problem as one string, which is what the overlay renders: the location on
 * the first line, read as the heading, and the message under it.
 * @param {string | Problem} item a problem, or a message on its own
 * @returns {string} the problem
 */
export function problemLine(item: string | Problem): string;
/**
 * A problem split for a console, where the level belongs in the heading rather
 * than being drawn around it.
 * @param {string} type `"warning"`, or anything else for an error
 * @param {string | Problem} item a problem, or a message on its own
 * @returns {{ header: string, body: string }} the problem, in two parts
 */
export function formatProblem(
  type: string,
  item: string | Problem,
): {
  header: string;
  body: string;
};
export type EXPECTED_ANY = any;
/**
 * One of webpack's errors or warnings, as `stats.toJson()` reports it. Only
 * the fields that say something about where and what; anything else on a
 * `StatsError` is ignored.
 */
export type Problem = {
  /**
   * the file the problem is in
   */
  file?: string | undefined;
  /**
   * the module's request, loaders and all
   */
  moduleName?: string | undefined;
  /**
   * line and column within the module
   */
  loc?: string | undefined;
  /**
   * what went wrong
   */
  message?: string | undefined;
  /**
   * frames webpack attached, when it did
   */
  stack?: (string[] | EXPECTED_ANY) | undefined;
};
