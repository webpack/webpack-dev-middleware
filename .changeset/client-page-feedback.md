---
"webpack-dev-middleware": minor
---

pr: #2425

The client posts build events to the page the way webpack-dev-server's does (`webpackOk`, `webpackErrors`, `webpackClose` and the rest), logs `Disconnected!` when the connection drops and clears the build's problems from the overlay until it is back. `progress` accepts `"circular"` or `"linear"`. Reloads skip a page that is already navigating away, use the nearest ancestor with a url of its own inside an `about:blank` iframe, and in `apply: "reload"` follow a sibling compilation's build too.
