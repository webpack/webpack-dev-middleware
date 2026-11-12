---
"webpack-dev-middleware": patch
---

In plugin mode, `close()` no longer warns when it closed its own hot transport, so a host can call it to close that transport on shutdown.
