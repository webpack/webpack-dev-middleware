---
"webpack-dev-middleware": patch
---

Typed `publish(payload)` as taking a payload of your own, rather than only the keys this middleware itself publishes. `action` is still required — it is what a client tells one payload from another by — and everything beyond it now travels untouched.

`publish` exists for what a server measures that the middleware does not, and such a payload carries whatever that server has to say. webpack-dev-server's own `ProgressPlugin` reports which plugin a tick came from, which is more than `percent` and `message`; a `subscribe` handler is what reads it. Typing it shut made the shape of a published payload this middleware's to approve, which is the opposite of what the method is for — and it was a type error at the call site for a key that worked perfectly well at runtime.
