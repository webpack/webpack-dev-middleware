---
"webpack-dev-middleware": patch
---

Fixed a crash when calling `close()` in plugin mode (`isPlugin = true`). Since the host (webpack-cli, webpack-dev-server, etc.) owns `compiler.watch()`, the middleware has no `watching` of its own to close, so `close()` now just calls the callback instead of throwing.
