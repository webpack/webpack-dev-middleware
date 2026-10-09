---
"webpack-dev-middleware": minor
---

pr: #2458

`hot.client.apply` (`"hmr"`, `"hmr-only"`, `"reload"` or `"nothing"`) says what a build does to the page, so a project without HMR still reloads on a change; a single page can choose its own mode with `?webpack-dev-middleware-apply=`, and publishing `{ action: "reload" }` reloads every page. `hot.client.connect` (`false`, or `{ retries, timeout }`) controls connecting and reconnecting, with `retries` honoured on both transports. The `hot`, `liveReload`, `reload`, `autoConnect`, `reconnect` and `timeout` query parameters they replace are still read until the next major release, with a deprecation warning for this package's own three.
