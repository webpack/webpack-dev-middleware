---
"webpack-dev-middleware": minor
---

The client can now keep a page up to date without Hot Module Replacement. `hot`
(default `true`) says whether a build is applied as an update, and `live-reload`
(default `true`) reloads the page on a build that changed something when it is
not — so a project with no `HotModuleReplacementPlugin` still sees its changes.
A build that changed nothing is left alone either way.

Added a `reload` action, for a change no compilation knows about: publish
`{ action: "reload" }` and every page loads itself again, whatever `hot` and
`live-reload` are set to. It does what the `subscribe()` example in the README
used to have you write by hand.

Added `urlPrefix` (default `"webpack-dev-middleware"`), which names the page-url
parameters that turn `hot` and `live-reload` off for a single page —
`?webpack-dev-middleware-live-reload=false`.

`live-reload` used to be accepted as another spelling of `reload`. The two are
different — `reload` is the fallback for an update that was tried and could not
be applied — and `live-reload` now means what it says. It was never released
under the old meaning.
