---
"webpack-dev-middleware": minor
---

Take the diagnostics a hot payload carries from the `stats` option, so one setting governs what a build reports in the terminal and in the browser: `stats: "errors-only"` keeps warnings out of both, and `stats: false` keeps errors and warnings out of both, the client's error overlay included — reach for the client's `?logging=` or `?overlay=` to quiet the browser alone. `hot.statsOptions` is deprecated and will be removed in the next major release; its `hash`, `timings` and `children` keys are now ignored, because they could leave a payload without the hash the client compares, or carry a child compilation's hash instead, which stopped updates applying and forced a full page reload on every rebuild.
