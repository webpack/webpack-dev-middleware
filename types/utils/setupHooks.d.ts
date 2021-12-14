/** @typedef {import("../index.js").Context} Context */
/** @typedef {import("webpack").Configuration} Configuration */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {Configuration["stats"]} StatsOptions */
/** @typedef {{ children: Configuration["stats"][] }} MultiStatsOptions */
/** @typedef {Exclude<Configuration["stats"], boolean | string | undefined>} NormalizedStatsOptions */
/** @typedef {{ children: StatsOptions[], colors?: any }} MultiNormalizedStatsOptions */
/**
 * @param {Context} context
 */
export default function setupHooks(context: Context): void;
export type Context = import("../index.js").Context;
export type Configuration = import("webpack").Configuration;
export type Compiler = import("webpack").Compiler;
export type MultiCompiler = import("webpack").MultiCompiler;
export type Stats = import("webpack").Stats;
export type MultiStats = import("webpack").MultiStats;
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
