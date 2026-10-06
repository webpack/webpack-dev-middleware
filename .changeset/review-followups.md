---
"webpack-dev-middleware": patch
---

Follow-ups from the review of the client and `hot` changes. `hot.client.connect.timeout: Infinity` is no longer turned into a huge number (it is also the delay handed to `setTimeout`, which wraps above 2^31 - 1 ms and would reconnect in a loop); only `retries` is. An `error` action sent without a `message` now posts the text the client logged, instead of `undefined`. An object-form `cache.control` is copied when the middleware is created. The `hot.progress` deprecation says to remove it before adding a plugin of your own, and the `hot.cors` description says what it controls on each transport.
