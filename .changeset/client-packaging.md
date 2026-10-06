---
"webpack-dev-middleware": patch
---

pr: #2428

The client exports ship type declarations and are marked as the ES modules they are. The client logs through webpack's `Logger` without `webpack/lib/logging/runtime.js`, so `universal` and `["web", "node"]` bundles no longer pull in a node builtin and a page enforcing Trusted Types needs no guard. A module that re-exports the client can hand it its options through `__webpack_dev_middleware_client_query__`, and `?autoConnect` is read like every other boolean.
