---
"webpack-dev-middleware": minor
---

pr: #2436

Added `hot.client`, which sets the browser runtime's options on the middleware under the same names the entry query takes, so a configuration no longer needs a hand-written query string. `path` accepts a url or its parts (`{ port: 8080 }`) and resolves the rest in the page, and `logging` accepts `{ level, name }` so an embedding package can label the console with its own name.
