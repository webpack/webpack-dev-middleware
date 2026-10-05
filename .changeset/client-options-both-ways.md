---
"webpack-dev-middleware": minor
---

every browser option can be set on the middleware as well as on the query

`hot.client` and the injected entry's query are now one option set rather than
two overlapping ones. `hot`, `liveReload` and `urlPrefix` were readable from the
query alone and can now be set in node:

```js
app.use(
  middleware(compiler, {
    hot: { client: { hot: false, liveReload: true, urlPrefix: "my-server" } },
  }),
);
```

`transport`, `path` and `name` go the other way: they were the middleware's to
set, and can now be overridden, which is what a page reaching the endpoint
through a proxy or on another origin needs.

```js
app.use(
  middleware(compiler, {
    hot: { client: { path: "wss://dev.example.com/__webpack_hmr" } },
  }),
);
```

The middleware's own values — the resolved `hot.transport`, the resolved
`hot.path` and the compilation's name — remain the defaults, so nothing changes
for anyone not setting them.

A `hot.transport` of your own now gets a client too, when `hot.client.transport`
says which of the two built-in protocols yours carries. Without it the client is
still yours to add, as before.

Every option is spelled one way in `hot.client` and in the entry query alike,
apart from the six names kept working for a release after `apply` and `connect`
replaced them. One option, `apply`, can also be set for a single page through a
url parameter (`?webpack-dev-middleware-apply=nothing`); the rest are the
middleware's and the entry's to set. The two second spellings the query had
picked up from webpack-dev-server — `webSocketURL` for `path` and `live-reload`
for `liveReload` — are gone. Neither alias was ever released.
