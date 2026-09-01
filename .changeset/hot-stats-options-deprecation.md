---
"webpack-dev-middleware": patch
---

Ignore the `hot.statsOptions` keys that break hot module replacement — `hash`, `timings` and `children` now keep their values, so a payload can no longer lose the hash the client compares or carry a child compilation's instead. The option is deprecated and will be removed in the next major release.
