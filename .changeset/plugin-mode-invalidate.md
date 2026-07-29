---
"webpack-dev-middleware": patch
---

Fixed a crash when calling `invalidate()` in plugin mode (`isPlugin = true`). Since the host (webpack-cli, webpack-dev-server, etc.) owns `compiler.watch()`, the middleware now invalidates the host's `watching` instead (each child compiler's one for a `MultiCompiler` on webpack < 5.109), and logs a warning when the compiler is not watching at all.
