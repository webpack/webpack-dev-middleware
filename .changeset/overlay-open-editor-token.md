---
"webpack-dev-middleware": minor
---

The overlay sends the client's token along when it asks `openEditorEndpoint` to open a file, so a server can tell the overlay's request from one another page made. Only to an endpoint on the page's own server (a rooted path), never to an absolute url, and only when the client was given a token.
