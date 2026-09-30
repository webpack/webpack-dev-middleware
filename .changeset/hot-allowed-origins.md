---
"webpack-dev-middleware": minor
---

The Server-Sent Events endpoint no longer answers every request with `Access-Control-Allow-Origin: *`. That grant, inherited from `webpack-hot-middleware`, let any site loaded in the same browser read a build's payloads, which carry its module paths and the source frames webpack puts in a failed build's errors. Without it the browser's own same-origin rule applies, so only a page on the endpoint's own origin can read the stream — which is the normal setup and needs no change.

A page served from a different origin than the middleware now has to be named, through the new `hot.allowedOrigins` option: a list of origins, or `true` to grant every one of them as before.

The option is a grant rather than a check — nothing is refused — and it does not apply to the `ws` transport, where a handshake is not subject to CORS. Refusing an upgrade stays the job of the server that owns it, through `onConnect(fn)` or `handleUpgrade`.
