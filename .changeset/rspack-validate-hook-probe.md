---
"webpack-dev-middleware": patch
---

Fix initialization with rspack, whose `compiler.hooks` throws when reading the `validate` hook it doesn't implement.
