---
"webpack-dev-middleware": patch
---

Give an `overlay.runtimeErrors` filter the rejected value through `error.cause`, so a rejection carrying a plain object rather than an `Error` can still be judged on what it carries
