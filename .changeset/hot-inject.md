---
"webpack-dev-middleware": minor
---

pr: #2430

`hot` now adds the client and `HotModuleReplacementPlugin` to the compilation itself, so enabling it is all a webpack configuration needs; `hot.inject: false` turns this off for anyone wiring it by hand. Web workers get a client too, nothing is injected into a non-browser target, and the HMR plugin is left out when `hot.client.apply` is `reload` or `nothing`.
