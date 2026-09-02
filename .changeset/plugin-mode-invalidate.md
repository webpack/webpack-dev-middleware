---
"webpack-dev-middleware": patch
---

Fixed a crash when calling `invalidate()` in plugin mode (`isPlugin = true`). Since the host (webpack-cli, webpack-dev-server, etc.) owns `compiler.watch()`, the middleware now invalidates the host's `watching` instead (each child compiler's one for a `MultiCompiler` on webpack < 5.109). When nothing is watching it logs a warning and completes the callback, as `close()` does, rather than leaving `invalidate(callback)` waiting on a build that never runs.
