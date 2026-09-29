---
"webpack-dev-middleware": minor
---

Added `hot.client`, so the browser runtime's options are set on the middleware
along with the rest of the hot configuration instead of in a query string on an
entry. It is read when the client is injected; `overlay`, `progress`, `reload`,
`logging`, `reconnect`, `timeout`, `autoConnect` and `dynamicPublicPath` are
accepted, and `overlay` takes the same object (filter functions included) as the
query does. `transport`, `path` and `name` are not accepted: the middleware
knows those and sets them itself, so the runtime cannot be pointed somewhere the
server is not listening.
