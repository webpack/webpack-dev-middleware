---
"webpack-dev-middleware": patch
---

Fixed `hot.client.connect` set as an object on the middleware being dropped. The browser options travel to the runtime as its entry's query, where every value but `overlay` went through `String(value)` — so `{ retries: 3, timeout: 5000 }` arrived as the text `"[object Object]"`, which the client failed to parse and then read as the boolean `true`. Both fields were lost without a warning, and the connection used the defaults. Any value that is an object is now serialized as JSON, which is the shape the client parses it out of, so an option that grows an object form later needs no change here.
