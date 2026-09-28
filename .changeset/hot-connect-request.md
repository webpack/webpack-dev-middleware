---
"webpack-dev-middleware": minor
---

Added `handleUpgrade(req, socket, head)` and `onConnect(fn)`, so a server can
decide for itself who may listen to the hot endpoint. `handleUpgrade` answers
one WebSocket upgrade for a server that keeps its own `upgrade` listener,
instead of handing the whole server over with `attach`, and says whether the
request was the endpoint's. `onConnect` is called with each client and the
request it joined with, before anything is published to it, so a client closed
there is sent nothing at all.

`onConnect` is now given the request in both transports; it used to be dropped,
which left nothing to judge a client by.
