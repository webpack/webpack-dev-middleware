---
"webpack-dev-middleware": minor
---

The client says so when the connection goes away, and takes the build's problems out of the overlay while it is gone.

It logs `Disconnected!` once per outage, at the moment the connection is lost — the counterpart of `connected`, and what webpack-dev-server's client has always printed there. It is once per outage rather than once per failed attempt: Server-Sent Events keep retrying for as long as the page is open, and a line per retry would bury everything else. The `webpackClose` message the page already received is unchanged.

The overlay is cleared of build errors and warnings at the same moment. What the server last said about the build is stale once the server is gone, and an overlay left up keeps showing errors nothing can fix from here. Nothing is lost: a reconnection is caught up on the current build, so whatever is still wrong is reported again, in the console as well as the overlay.

Only the build's problems go. An uncaught runtime error is the page's own, and a lost connection says nothing about whether it is still true — it stays up.

Before this, a stopped server left a page that looked live, with a console that never said otherwise and an overlay frozen on the last build.
