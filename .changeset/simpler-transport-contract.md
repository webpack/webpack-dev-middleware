---
"webpack-dev-middleware": minor
---

A custom `hot.transport` now needs only four methods — `onConnect`, `publish`, `publishTo` and `close`. `handler` and `hasClients` became optional: without a `handler` a request on the endpoint's path is answered `426 Upgrade Required`, and without `hasClients` a payload is built and the transport decides for itself in `publish`. A transport that implements all six keeps working unchanged
