---
"webpack-dev-middleware": patch
---

Leave `HotModuleReplacementPlugin` out when `hot.client.apply` is `reload` or `nothing`. Those modes never apply an update in place, so the HMR runtime only made the bundle larger; a plugin already in the configuration is kept. A page whose url asks for `hmr` against a bundle without the runtime reloads instead of staying on stale code.
