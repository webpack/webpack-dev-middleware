---
"webpack-dev-middleware": minor
---

Added `hot.cors`, which says which origins may reach the hot endpoint from a page on another one, over either transport.

The Server-Sent Events endpoint answers every request with `Access-Control-Allow-Origin: *`, inherited from `webpack-hot-middleware`, and nothing could turn it off. A payload carries a build's module paths and the source frames webpack puts in a failed build's errors, so that grant lets any site loaded in the same browser read part of the developer's source. `hot.cors` is how to narrow it: an origin, a list of origins and patterns, a regular expression, a predicate, `{ origin }` as Vite and `expressjs/cors` are configured, `false` for nothing but the endpoint's own origin, or `true` for every one of them. An allowed origin is echoed back with `Vary: Origin` rather than wildcarded.

**The two transports default differently, and deliberately.** Server-Sent Events keeps granting every origin, because narrowing it would stop a page served from another origin reading its own build — a breaking change, which waits for a major release. The WebSocket transport is new here, so it starts where the other one is going: local origins only (`localhost` and anything under it, `127.0.0.1`, `[::1]`, any port, either scheme), the same set and the same reasoning as Vite's `server.cors` default. Set `cors` to narrow the event stream today; the next major release will do it for you.

Each transport enforces it where its wire allows. The event stream carries the grant or withholds it, and refuses nothing. A WebSocket handshake is not subject to CORS — a browser sends `Origin` and pays no attention to what comes back — so there the upgrade is refused with `403` before the handshake completes, through both `attach(server)` and `handleUpgrade(req, socket, head)`. A request carrying no `Origin` at all, and one whose `Origin` is the one it was addressed to, are allowed either way.

A server that already decides for itself who may connect should set `cors: true`, so its own rule is the only one.
