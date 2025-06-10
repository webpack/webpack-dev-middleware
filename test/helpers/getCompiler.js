import webpack from "webpack";

import defaultConfig from "../fixtures/webpack.config";

/** @typedef {import("webpack").Configuration} Configuration */
/** @typedef {import("webpack").Compiler} Compiler */

/**
 * @param {Configuration} config config
 * @returns {Compiler} compiler
 */
function getCompiler(config) {
  return webpack(config || defaultConfig);
}

export default getCompiler;
