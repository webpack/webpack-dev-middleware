---
"webpack-dev-middleware": patch
---

In `apply: "reload"`, load the page when another compilation of a multi-compiler build finishes. The `name` filter kept a sibling's build away from the client entirely, which is right for applying an update in place, but a page rendered from another bundle's output, such as a server bundle, was never told to reload when that bundle changed. A build with errors still leaves the page alone.
