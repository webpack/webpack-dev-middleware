---
"webpack-dev-middleware": patch
---

The client keeps doing what webpack-dev-server's did:

- A page url with a malformed escape no longer stops every update.
- `apply: "reload"` reloads a reconnected page whose build is out of date.
- A build's warnings are logged and posted along with its errors.
- An entry written for that server's query (`hostname`, `port`, `pathname`, `live-reload`, `hot=only`) still connects, with no deprecation warning for that server's own spelling.
- The published client is ES5 down to the logger.
- The overlay sits at the highest `z-index` and closes on `Esc`.
- The building indicator works without Shadow DOM and is announced as a progress bar.
