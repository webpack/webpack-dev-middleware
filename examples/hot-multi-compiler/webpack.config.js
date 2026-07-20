const path = require("path");
const webpack = require("webpack");

// The package `exports` field does not allow query strings on subpaths, so
// resolve the client entry to a file path first and append the query to that.
const client = require.resolve("webpack-dev-middleware/client");

/**
 * Two compilers ("app" and "admin") sharing one middleware instance. Each
 * bundle carries the client runtime with `?name=<compilation name>` so it only
 * applies updates for its own compiler — both share a single SSE connection.
 * @param {string} name compilation name
 * @param {string} entry app entry
 * @returns {import("webpack").Configuration} configuration
 */
function makeConfig(name, entry) {
  return {
    name,
    mode: "development",
    context: __dirname,
    entry: [`${client}?name=${name}`, entry],
    output: {
      path: path.resolve(__dirname, "dist"),
      publicPath: "/",
      filename: `${name}.js`,
      // Both bundles run on the same page: without a distinct uniqueName they
      // would share the same global `webpackHotUpdate…` callback and each
      // other's hot updates would land in the wrong runtime.
      uniqueName: name,
      hotUpdateChunkFilename: `${name}.[id].[fullhash].hot-update.js`,
      hotUpdateMainFilename: `${name}.[runtime].[fullhash].hot-update.json`,
    },
    plugins: [new webpack.HotModuleReplacementPlugin()],
  };
}

module.exports = [
  makeConfig("app", "./src/index.js"),
  makeConfig("admin", "./src/admin.js"),
];
