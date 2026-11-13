---
"webpack-dev-middleware": patch
---

Clean the files `writeToDisk` writes when `output.clean` is set. webpack wrote the build to memory and cleaned only that, so the copies on disk were never cleaned: the previous session's files stayed, and every rebuild left another `main.[contenthash].js` behind. The middleware now gives webpack a file system that writes to memory and, for the files `writeToDisk` takes, to disk, and that removes and lists files on both, so `output.clean` cleans the disk too, honoring `clean.keep` and `clean.dry`, in plugin mode as in standalone mode, with every webpack 5 version and with Rspack. `writeToDisk: true` with a file system of your own, in `outputFileSystem` or on the compiler, now writes to disk too: it wrote nothing there before.
