---
"webpack-dev-middleware": patch
---

Log from the client with webpack's `Logger` and `createConsoleLogger` directly, leaving out `webpack/lib/logging/runtime.js`. That module is a few lines of glue around those two and a `tapable` hook the client never uses, and `tapable` asks for `util` and compiles its hooks with `new Function`: in a `universal` or `["web", "node"]` build the client's bundle got a `createRequire` of a node builtin a page cannot call, and a page enforcing Trusted Types had to have every log call guarded. The levels and the `[name] message` labels are webpack's, as before.
