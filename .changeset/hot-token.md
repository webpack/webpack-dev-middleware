---
"webpack-dev-middleware": minor
---

Added `hot.token`: a secret the injected client carries and the hot endpoint
requires, so reaching the stream takes something a page has to have been given
rather than a header the browser may or may not send.

`hot.cors` is answered by `Origin`, and that is its weakness. A browser omits
`Origin` and the whole `Sec-Fetch-*` family when the destination is not
potentially trustworthy — plain `http` to anything but `localhost`, which
`host: "0.0.0.0"` gives you. webpack-dev-server shipped two fixes built on
those headers and both were bypassed exactly that way, CVE-2026-6402 and then
CVE-2026-14620. A token asks the browser to volunteer nothing.

Off by default on both transports, and `true` in the next major release. A
token only reaches the browser on the entry the middleware adds, and `inject`
being on does not mean an entry was added: it is skipped when every entry point
already pulls the client in, when `hot.transport` is a function, and for a
non-web target. Requiring one by default would turn each of those into a `403`
on every client. Set `token: true` to turn it on, and if you do so where no
client was injected the middleware warns rather than leaving you with an
unexplained refusal.

With the client injected, that is all it takes: it is handed the token and puts
it on its connection url. `hot.inject: false` turns the requirement off — the
token travels in the entry the middleware adds, so with nothing injected there
is no way to hand one over. A configuration that lists the client entry itself
is built before the middleware exists and cannot carry a minted token, so give
it a fixed one both sides know, or read the minted one from `instance.token`.

What it does not protect: the client reads the token from its entry query, so
it is a string in the bundle. Anything that can already read the bundle
cross-origin reads the token with it, and over plain `http` to a non-localhost
address nothing stops that unless your server sends
`Cross-Origin-Resource-Policy`. This hardens every case where the bundle is not
readable, and is defence in depth in the case where it is.
