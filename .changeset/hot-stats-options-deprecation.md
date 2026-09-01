---
"webpack-dev-middleware": patch
---

Take the diagnostics a hot payload carries from the `stats` option, so one setting governs what a build reports in the terminal and in the browser, and deprecate `hot.statsOptions`. Its `hash`, `timings` and `children` keys are now ignored: they could leave a payload without the hash the client compares, or carry a child compilation's instead, which stopped updates applying and forced a full reload on every rebuild.
