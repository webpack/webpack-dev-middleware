---
"webpack-dev-middleware": minor
---

`hot.client: false` adds no runtime to the page while still applying `HotModuleReplacementPlugin`, which now goes to every compilation the middleware serves, including server bundles that hot-reload through `webpack/hot/poll`. `hot.client.transport` also accepts a module exporting a client class of your own, and the new `hot.ws` option is passed to the `ws` server (compression, `verifyClient`, or a `port` or `server` of its own), with `hot.cors` and `hot.token` still checked. The connection the runtime holds is exported as `webpack-dev-middleware/client/socket` for tooling that listens alongside it.
