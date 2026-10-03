---
"webpack-dev-middleware": minor
---

The client can now keep a page up to date without Hot Module Replacement. `hot`
(default `true`) says whether a build is applied as an update, and `liveReload`
(default `true`) reloads the page on a build that changed something when it is
not — so a project with no `HotModuleReplacementPlugin` still sees its changes.
A build that changed nothing is left alone either way.

Added a `reload` action, for a change no compilation knows about: publish
`{ action: "reload" }` and every page loads itself again, whatever `hot` and
`liveReload` are set to. It does what the `subscribe()` example in the README
used to have you write by hand.

Added `urlPrefix` (default `"webpack-dev-middleware"`), which names the page-url
parameter that overrides what a build does to a single page —
`?webpack-dev-middleware-apply=nothing`.

`live-reload` used to be accepted as another spelling of `reload`. The two are
different — `reload` is the fallback for an update that was tried and could not
be applied — so the one that reloads on a build is its own option, `liveReload`.
`live-reload` is not accepted under either meaning. It was never released.
