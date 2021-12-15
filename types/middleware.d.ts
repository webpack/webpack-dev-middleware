/// <reference types="node" />
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("./index.js").Context<Request, Response>} context
 * @return {import("./index.js").Middleware<Request, Response>}
 */
export default function wrapper<
  Request_1 extends import("http").IncomingMessage,
  Response_1 extends import("./index.js").ServerResponse
>(
  context: import("./index.js").Context<Request_1, Response_1>
): import("./index.js").Middleware<Request_1, Response_1>;
export type NextFunction = import("./index.js").NextFunction;
export type IncomingMessage = import("./index.js").IncomingMessage;
export type ServerResponse = import("./index.js").ServerResponse;
