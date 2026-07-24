const path = require("path");
const webpack = require("webpack");

// The package `exports` field does not allow query strings on subpaths, so
// resolve the client entry to a file path first and append the query to that.
const client = require.resolve("webpack-dev-middleware/client");

/**
 * Two separate compilations loaded on ONE page. Each bundle carries its own
 * copy of the overlay module; the window singleton makes both copies render
 * into a single shared overlay.
 * @type {import("webpack").Configuration[]}
 */
module.exports = [
  {
    // The regular hot client: reports build problems over SSE.
    name: "app",
    mode: "development",
    context: __dirname,
    entry: [`${client}?name=app`, "./src/app.js"],
    output: {
      path: path.resolve(__dirname, "dist"),
      publicPath: "/",
      filename: "app.js",
      uniqueName: "app",
      hotUpdateChunkFilename: "app.[id].[fullhash].hot-update.js",
      hotUpdateMainFilename: "app.[runtime].[fullhash].hot-update.json",
    },
    plugins: [new webpack.HotModuleReplacementPlugin()],
  },
  {
    // Plays the role of a second client (e.g. webpack-dev-server's once it
    // adopts this overlay): a separate bundle with its OWN copy of the
    // overlay module, reporting through its own `source` slot.
    name: "widget",
    mode: "development",
    context: __dirname,
    entry: "./src/widget.js",
    output: {
      path: path.resolve(__dirname, "dist"),
      publicPath: "/",
      filename: "widget.js",
      uniqueName: "widget",
    },
  },
];
