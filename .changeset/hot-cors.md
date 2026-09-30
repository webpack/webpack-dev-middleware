---
"webpack-dev-middleware": minor
---

Added `hot.cors`, which says which origins may reach the hot endpoint from a page on another one, and stopped both transports letting every origin reach it.

The Server-Sent Events endpoint answered every request with `Access-Control-Allow-Origin: *`, inherited from `webpack-hot-middleware`, and the WebSocket transport accepted a handshake from anywhere. A payload carries a build's module paths and the source frames webpack puts in a failed build's errors, so either one let any site loaded in the same browser read part of the developer's source.

The default allows local origins only — `localhost` and anything under it, `127.0.0.1` and `[::1]`, on any port and either scheme. That covers a page served by the middleware itself and a page on another port of the same machine, which is the one cross-origin case that is normal in development. It is the same default, for the same reason, as Vite's `server.cors`. Anywhere else has to be named: the option takes an origin, a list of origins and patterns, a regular expression, a predicate, `{ origin }` as Vite and `expressjs/cors` are configured, `false` for nothing but the endpoint's own origin, or `true` for the previous behavior.

The two transports enforce it where their wire allows. The event stream carries the grant or withholds it, and refuses nothing. A WebSocket handshake is not subject to CORS — a browser sends `Origin` and pays no attention to what comes back — so there the upgrade is refused with `403` before the handshake completes, through both `attach(server)` and `handleUpgrade(req, socket, head)`. A request carrying no `Origin` at all, and one whose `Origin` is the one it was addressed to, are allowed either way.

A server that already decides for itself who may connect should set `cors: true`, so its own rule is the only one.
