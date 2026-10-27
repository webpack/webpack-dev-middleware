---
"webpack-dev-middleware": patch
---

Clean the files `writeToDisk` writes when `output.clean` is set and `writeToDisk` is a function. webpack wrote the build to memory and cleaned only that, so the copies on disk were never cleaned: the previous session's files stayed, and every rebuild left another `main.[contenthash].js` behind. The disk is now cleaned by webpack's own `CleanPlugin` rules, honoring `clean.keep` and `clean.dry`, in plugin mode as in standalone mode. `writeToDisk: true` already worked. `writeToDisk: true` with an `outputFileSystem` of your own now writes to disk too: it wrote nothing there before.
