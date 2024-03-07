/// <reference types="node" />
export = ready;
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").Context<Request, Response>} context
 * @param {(...args: any[]) => any} callback
 * @param {Request} [req]
 * @returns {void}
 */
declare function ready<
  Request extends import("http").IncomingMessage,
  Response extends import("../index.js").ServerResponse,
>(
  context: import("../index.js").Context<Request, Response>,
  callback: (...args: any[]) => any,
  req?: Request | undefined,
): void;
declare namespace ready {
  export { IncomingMessage, ServerResponse };
}
type IncomingMessage = import("../index.js").IncomingMessage;
type ServerResponse = import("../index.js").ServerResponse;
