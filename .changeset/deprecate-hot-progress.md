---
"webpack-dev-middleware": patch
---

pr: #2451

Deprecated `hot.progress`, which keeps working until the next major release: a server that applies `ProgressPlugin` itself ended up with two on one compiler. Remove it, apply the plugin yourself and hand its ticks to [`publish`](https://github.com/webpack/webpack-dev-middleware#publishpayload); the browser-side `hot.client.progress` is unaffected.
