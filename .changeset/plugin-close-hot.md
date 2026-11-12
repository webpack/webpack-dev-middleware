---
"webpack-dev-middleware": patch
---

Close the built-in hot transport when the compiler shuts down, so in plugin mode `compiler.close()` no longer leaves a WebSocket endpoint and its heartbeat running.
