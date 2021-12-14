/// <reference types="node" />
/** @typedef {import("webpack").Configuration} Configuration */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/** @typedef {Configuration["stats"]} StatsOptions */
/** @typedef {{ children: Configuration["stats"][] }} MultiStatsOptions */
/** @typedef {Exclude<Configuration["stats"], boolean | string | undefined>} NormalizedStatsOptions */
/** @typedef {{ children: StatsOptions[], colors?: any }} MultiNormalizedStatsOptions */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").Context<Request, Response>} context
 */
export default function setupHooks<
  Request_1 extends import("http").IncomingMessage,
  Response_1 extends import("../index.js").ServerResponse
>(context: import("../index.js").Context<Request_1, Response_1>): void;
export type Configuration = import("webpack").Configuration;
export type Compiler = import("webpack").Compiler;
export type MultiCompiler = import("webpack").MultiCompiler;
export type Stats = import("webpack").Stats;
export type MultiStats = import("webpack").MultiStats;
export type IncomingMessage = import("../index.js").IncomingMessage;
export type ServerResponse = import("../index.js").ServerResponse;
export type StatsOptions = Configuration["stats"];
export type MultiStatsOptions = {
  children: Configuration["stats"][];
};
export type NormalizedStatsOptions = Exclude<
  Configuration["stats"],
  boolean | string | undefined
>;
export type MultiNormalizedStatsOptions = {
  children: StatsOptions[];
  colors?: any;
};
