const path = require("path");
const webpack = require("webpack");

module.exports = {
  mode: "development",
  // `webpack-dev-middleware/client` is the small runtime that subscribes to the
  // SSE endpoint served by the `hot` option and applies the updates. Add it as
  // the first entry next to your application code.
  entry: ["webpack-dev-middleware/client", "./src/index.js"],
  context: __dirname,
  output: {
    path: path.resolve(__dirname, "dist"),
    publicPath: "/",
    filename: "main.js",
  },
  plugins: [new webpack.HotModuleReplacementPlugin()],
};
