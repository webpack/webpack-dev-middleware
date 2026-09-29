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

Every option has one name and no aliases, in `hot.client`, in the entry query
and in the page-url parameters alike. The two second spellings the query had
picked up from webpack-dev-server — `webSocketURL` for `path` and `live-reload`
for `liveReload` — are gone, and so is the `-live-reload` page parameter, which
is now `-liveReload`. Neither alias was ever released.
