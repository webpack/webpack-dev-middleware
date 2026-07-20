const path = require("path");
const express = require("express");
const webpack = require("webpack");
const middleware = require("webpack-dev-middleware");
const config = require("./webpack.config.js");

const compiler = webpack(config);
const app = express();

// `hot: true` serves a Server-Sent Events endpoint (at `/__webpack_hmr` by
// default) that the browser runtime subscribes to. The bundled files are still
// served from memory at `output.publicPath`.
app.use(middleware(compiler, { hot: true }));

// Serve the demo page for any non-asset request.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Example app listening on http://localhost:${port}`);
});
