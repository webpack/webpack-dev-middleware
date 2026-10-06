---
"webpack-dev-middleware": patch
---

Leave `HotModuleReplacementPlugin` out when `hot.client.apply` is `reload` or `nothing`. Those modes never apply an update in place, so the HMR runtime only made the bundle larger; a plugin already in the configuration is kept.
