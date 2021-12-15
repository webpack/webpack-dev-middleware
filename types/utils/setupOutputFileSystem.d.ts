/// <reference types="node" />
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").Context<Request, Response>} context
 */
export default function setupOutputFileSystem<
  Request_1 extends import("http").IncomingMessage,
  Response_1 extends import("../index.js").ServerResponse
>(context: import("../index.js").Context<Request_1, Response_1>): void;
export type MultiCompiler = import("webpack").MultiCompiler;
export type IncomingMessage = import("../index.js").IncomingMessage;
export type ServerResponse = import("../index.js").ServerResponse;
