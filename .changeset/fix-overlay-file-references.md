---
"webpack-dev-middleware": patch
---

The overlay recognizes a file reference in every shape a stack frame carries
it, not just webpack's own relative paths. An absolute path
(`/home/me/src/app.js:3:1`), a Windows one (`C:\src\app.js:4:2`) and a
`file://` url are all clickable now; before, only `./` and `../` were, so a
runtime error's stack offered nothing to open.

A frame in webpack's generated runtime is left alone. It has no file behind it,
and now that an absolute path is recognized it would otherwise be offered for
opening and the endpoint asked for something it cannot do.

A file reference inside a url is left to the url. `https://example.test/app.js`
is a link, and its path is not somewhere an editor can go.

An editor that does not open says so, rather than nothing happening: the
reference gets a title explaining it, and the console gets the reason and which
endpoint was asked.
