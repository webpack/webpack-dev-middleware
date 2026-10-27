---
"webpack-dev-middleware": patch
---

Clean the files `writeToDisk` writes when `output.clean` is set and `writeToDisk` is a function. webpack wrote the build to memory and cleaned only that, so the copies on disk were never cleaned: the previous session's files stayed, and every rebuild left another `main.[contenthash].js` behind. With webpack 5.113.0 or later the middleware adds the disk as an additional output (`compiler.hooks.additionalOutputs`), so webpack writes the files there itself, links, permissions and times included, and `output.clean` cleans the disk too, honoring `clean.keep` and `clean.dry`, in plugin mode as in standalone mode; with an older webpack or Rspack the middleware copies to disk as before. `writeToDisk: true` with an `outputFileSystem` of your own now writes to disk too: it wrote nothing there before.
