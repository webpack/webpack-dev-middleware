---
"webpack-dev-middleware": patch
---

Leave `HotModuleReplacementPlugin` out when `hot.client.apply` is `reload` or `nothing`. Those modes never apply an update in place, so the HMR runtime only made the bundle larger; a plugin already in the configuration is kept. A page whose url asks for `hmr` where the project left the runtime out on purpose reloads instead of staying on stale code; a runtime missing from a project that wanted one is still only reported.
