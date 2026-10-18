---
"webpack-dev-middleware": minor
---

`hot.token` also takes `{ value, required }`. With `required: false` a token is minted (or `value` used) and handed to the injected client as usual, but the endpoint does not refuse a client without it, so a server with policy of its own can compare it in `onConnect` alongside, say, the origins it already allows. The instance's new `hot.tokenRequired` says which applies.
