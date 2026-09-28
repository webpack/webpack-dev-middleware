---
"webpack-dev-middleware": minor
---

`hot` now puts the client runtime and `HotModuleReplacementPlugin` into the compilation itself, so enabling it is the whole of what a webpack configuration needs — no entry to add, no plugin to apply. The client is told the endpoint and the transport the middleware resolved, so the two cannot drift apart. A configuration that already has the client as an entry is left alone, nothing is injected into a compilation that does not target the browser, and `hot.inject: false` turns it off for anyone who would rather wire it themselves
