---
"webpack-dev-middleware": patch
---

Bound the internal url and `Range` header caches, which grew for the life of the process and were never released, even by `close()`.
