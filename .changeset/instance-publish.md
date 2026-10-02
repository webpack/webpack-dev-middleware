---
"webpack-dev-middleware": minor
---

Added `publish(payload)` to the instance, which puts a payload of your own on the hot stream. The middleware publishes what it knows about — a build starting, finishing, failing — and anything else a server measures is its own; `ProgressPlugin` is the example. The bundled client already renders `{ action: "progress" }`, so a server that applies the plugin itself now has somewhere to put what it reports. Nothing is sent when no client is connected, and it does nothing when `hot` is off.
