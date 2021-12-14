/** @typedef {import("../index.js").Context} Context */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/**
 * @param {Context} context
 */
export default function getPaths(context: Context): {
  outputPath: string;
  publicPath: string;
}[];
export type Context = import("../index.js").Context;
export type Compiler = import("webpack").Compiler;
export type Stats = import("webpack").Stats;
export type MultiStats = import("webpack").MultiStats;
