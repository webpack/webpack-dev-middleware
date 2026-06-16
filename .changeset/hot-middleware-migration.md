---
"webpack-dev-middleware": minor
---

Added a `hot` option that enables hot module replacement, replacing the need for `webpack-hot-middleware`. Pass `hot: true` to enable with defaults, or `hot: { path, heartbeat, log, statsOptions }` to customize. The client runtime is served by the middleware itself.
