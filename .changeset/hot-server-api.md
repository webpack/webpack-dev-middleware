---
"webpack-dev-middleware": minor
---

pr: #2431

The instance gains `attach(server)`, `handleUpgrade(req, socket, head)`, `onConnect(fn)` (now given the request as well as the client), `publish(payload)` and `publishTo(client, payload)`, so a server can own the upgrade, decide who may listen and put payloads of its own on the stream, such as `ProgressPlugin` ticks. The client understands `{ action: "error", message }`, logging the reason a server refused it and posting it to the page as `webpackError`.
