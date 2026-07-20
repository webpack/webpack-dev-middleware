const path = require("path");
const webpack = require("webpack");

// Opt-in build warning so the overlay's warning display can be tried out:
// run the server with `DEMO_WARNING=1`. Warnings are shown in the overlay by
// default; hide them with `?overlay={"warnings":false}` on the client entry.
const demoWarningPlugin = {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap("DemoWarning", (compilation) => {
      compilation.warnings.push(
        new Error("Demo: this is a sample build warning"),
      );
    });
  },
};

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
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    ...(process.env.DEMO_WARNING ? [demoWarningPlugin] : []),
  ],
};
