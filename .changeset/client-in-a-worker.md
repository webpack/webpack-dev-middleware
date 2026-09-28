---
"webpack-dev-middleware": minor
---

The hot client now runs in a web worker. It connected only where there was a
`window`, which a worker has none of — but it has `EventSource`, `WebSocket`
and webpack's runtime, which is all an update needs, so the client reads `self`
instead. In a page that is the same object, so nothing changes there.

The overlay and the building indicator stay with the page, since a worker has
no document. A reload cannot happen from inside one either — there is no
`location.reload` in a worker — so when an update cannot be applied the client
says so once and leaves the page that started the worker to reload it.

It is not injected into `target: "webworker"` compilations yet: that would
change what every worker bundle contains, which belongs in a major release.
Adding the entry to a worker configuration yourself works now.
