/// <reference types="node" />
export = setupHooks;
/** @typedef {import("webpack").Configuration} Configuration */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/** @typedef {Configuration["stats"]} StatsOptions */
/** @typedef {{ children: Configuration["stats"][] }} MultiStatsOptions */
/** @typedef {Exclude<Configuration["stats"], boolean | string | undefined>} StatsObjectOptions */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").Context<Request, Response>} context
 */
declare function setupHooks<
  Request extends import("http").IncomingMessage,
  Response extends import("../index.js").ServerResponse,
>(context: import("../index.js").Context<Request, Response>): void;
declare namespace setupHooks {
  export {
    Configuration,
    Compiler,
    MultiCompiler,
    Stats,
    MultiStats,
    IncomingMessage,
    ServerResponse,
    StatsOptions,
    MultiStatsOptions,
    StatsObjectOptions,
  };
}
type Configuration = import("webpack").Configuration;
type Compiler = import("webpack").Compiler;
type MultiCompiler = import("webpack").MultiCompiler;
type Stats = import("webpack").Stats;
type MultiStats = import("webpack").MultiStats;
type IncomingMessage = import("../index.js").IncomingMessage;
type ServerResponse = import("../index.js").ServerResponse;
type StatsOptions = Configuration["stats"];
type MultiStatsOptions = {
  children: Configuration["stats"][];
};
type StatsObjectOptions = Exclude<
  Configuration["stats"],
  boolean | string | undefined
>;
