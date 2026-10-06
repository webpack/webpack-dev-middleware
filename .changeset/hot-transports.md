---
"webpack-dev-middleware": minor
---

pr: #2420

`hot.transport` chooses how events reach the browser: Server-Sent Events (the default), `"ws"` for a WebSocket, or a transport of your own, which only needs `onConnect`, `publish`, `publishTo` and `close`. The client speaks both built-in wires, also exported as `webpack-dev-middleware/client/sse` and `webpack-dev-middleware/client/ws`, and behaves the same on either.
