/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Compilation} Compilation */
/** @typedef {import("../index.js").Context} Context */
/**
 * @param {Context} context
 */
export default function setupWriteToDisk(context: Context): void;
export type Compiler = import("webpack").Compiler;
export type MultiCompiler = import("webpack").MultiCompiler;
export type Compilation = import("webpack").Compilation;
export type Context = import("../index.js").Context;
