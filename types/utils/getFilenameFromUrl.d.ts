/// <reference types="node" />
export = getFilenameFromUrl;
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").Context<Request, Response>} context
 * @param {string} url
 * @param {Extra=} extra
 * @returns {string | undefined}
 */
declare function getFilenameFromUrl<
  Request extends import("http").IncomingMessage,
  Response extends import("./getPaths").ServerResponse,
>(
  context: import("../index.js").Context<Request, Response>,
  url: string,
  extra?: Extra | undefined,
): string | undefined;
declare namespace getFilenameFromUrl {
  export { Extra, IncomingMessage, ServerResponse };
}
type Extra = {
  stats?: import("fs").Stats | undefined;
  errorCode?: number | undefined;
};
type IncomingMessage = import("../index.js").IncomingMessage;
type ServerResponse = import("../index.js").ServerResponse;
