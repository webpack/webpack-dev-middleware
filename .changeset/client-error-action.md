---
"webpack-dev-middleware": minor
---

The runtime understands `{ action: "error", message }`, for something a server decided about one client rather than about a build.

A server applying a policy of its own — webpack-dev-server's `allowedHosts` is the case this exists for — refuses a client and holds the only explanation for it. There was nowhere to put that: an unknown action reaches a `subscribeAll` handler and otherwise goes nowhere, so the connection closed with the reason nowhere the developer was looking. The message is now logged as the server gave it, and posted to the page as `webpackError` so tooling watching the stream sees it too.

It carries no policy with it. Which clients to refuse, and why, stays entirely the server's; this is only somewhere to say so.
