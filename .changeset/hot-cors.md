---
"webpack-dev-middleware": minor
---

The Server-Sent Events endpoint no longer answers every request with `Access-Control-Allow-Origin: *`. That grant, inherited from `webpack-hot-middleware`, let any site loaded in the same browser read a build's payloads, which carry its module paths and the source frames webpack puts in a failed build's errors.

The grant is now scoped by a new `hot.cors` option, defaulting to local origins only — `localhost` and anything under it, `127.0.0.1` and `[::1]`, on any port and either scheme. That covers a page served by the middleware itself, which needs no grant at all, and a page on another port of the same machine, which is the one cross-origin case that is normal in development. It is the same default, for the same reason, as Vite's `server.cors`.

A page served from anywhere else now has to be named: `hot.cors` takes an origin, a list of origins and patterns, a regular expression, a predicate, `{ origin }` as Vite and `expressjs/cors` are configured, `false` for no grant at all, or `true` for the previous behavior. An allowed origin is echoed back with `Vary: Origin` rather than wildcarded.

The option is a grant rather than a check — nothing is refused — and it does not apply to the `ws` transport, where a handshake is not subject to CORS. Refusing an upgrade stays the job of the server that owns it, through `onConnect(fn)` or `handleUpgrade`.
