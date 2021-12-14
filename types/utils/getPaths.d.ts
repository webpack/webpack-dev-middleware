/// <reference types="node" />
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").Context<Request, Response>} context
 */
export default function getPaths<
  Request_1 extends import("http").IncomingMessage,
  Response_1 extends import("../index.js").ServerResponse
>(
  context: import("../index.js").Context<Request_1, Response_1>
): {
  outputPath: string;
  publicPath: string;
}[];
export type Compiler = import("webpack").Compiler;
export type Stats = import("webpack").Stats;
export type MultiStats = import("webpack").MultiStats;
export type IncomingMessage = import("../index.js").IncomingMessage;
export type ServerResponse = import("../index.js").ServerResponse;
