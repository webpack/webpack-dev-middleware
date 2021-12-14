/** @typedef {import("../index.js").Context} Context */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */

/**
 * @param {Context} context
 */
export default function getPaths(context) {
  const { stats, options } = context;
  /** @type {Stats[]} */
  const childStats =
    /** @type {MultiStats} */
    (stats).stats
      ? /** @type {MultiStats} */ (stats).stats
      : [/** @type {Stats} */ (stats)];
  const publicPaths = [];

  for (const { compilation } of childStats) {
    // The `output.path` is always present and always absolute
    const outputPath = compilation.getPath(compilation.outputOptions.path || "");
    const publicPath = options.publicPath
      ? compilation.getPath(options.publicPath)
      : compilation.outputOptions.publicPath
      ? compilation.getPath(compilation.outputOptions.publicPath)
      : "";

    publicPaths.push({ outputPath, publicPath });
  }

  return publicPaths;
}
