---
"webpack-dev-middleware": patch
---

Send `hot.client.connect.retries: Infinity` to the client as a number it keeps. The entry query is JSON, which writes `Infinity` as `null`; the client dropped that and fell back to its default, so a server asking never to give up reconnecting got ten retries instead.
