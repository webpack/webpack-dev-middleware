export = getFilenameFromUrl;
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").FilledContext<Request, Response>} context context
 * @param {string} url url
 * @returns {{ filename: string, extra: Extra } | undefined} result of get filename from url
 */
declare function getFilenameFromUrl<
  Request extends IncomingMessage,
  Response extends ServerResponse,
>(
  context: import("../index.js").FilledContext<Request, Response>,
  url: string,
):
  | {
      filename: string;
      extra: Extra;
    }
  | undefined;
declare namespace getFilenameFromUrl {
  export { FilenameError, IncomingMessage, ServerResponse, Extra };
}
/**
 * @typedef {object} Extra
 * @property {import("fs").Stats} stats stats
 * @property {boolean=} immutable true when immutable, otherwise false
 */
/**
 * decodeURIComponent.
 *
 * Allows V8 to only deoptimize this fn instead of all of send().
 * @param {string} input
 * @returns {string}
 */
declare class FilenameError extends Error {
  /**
   * @param {string} message message
   * @param {number=} code error code
   */
  constructor(message: string, code?: number | undefined);
  code: number | undefined;
}
type IncomingMessage = import("../index.js").IncomingMessage;
type ServerResponse = import("../index.js").ServerResponse;
type Extra = {
  /**
   * stats
   */
  stats: import("fs").Stats;
  /**
   * true when immutable, otherwise false
   */
  immutable?: boolean | undefined;
};
