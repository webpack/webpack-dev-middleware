/// <reference types="node" />
export = getFilenameFromUrl;
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").Context<Request, Response>} context
 * @param {string} url
 * @returns {string | undefined}
 */
declare function getFilenameFromUrl<
  Request extends import("http").IncomingMessage,
  Response extends import("./getPaths").ServerResponse,
>(
  context: import("../index.js").Context<Request, Response>,
  url: string,
): string | undefined;
declare namespace getFilenameFromUrl {
  export { IncomingMessage, ServerResponse };
}
type IncomingMessage = import("../index.js").IncomingMessage;
type ServerResponse = import("../index.js").ServerResponse;
