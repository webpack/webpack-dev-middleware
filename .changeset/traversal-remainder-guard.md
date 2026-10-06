---
"webpack-dev-middleware": patch
---

Hardened the path-traversal guards in `getFilenameFromUrl`: the remainder left after the `publicPath` prefix is stripped is checked for `..` on its own, before it is joined onto the output root. A `..` that leaves the output root and comes back into it, such as `/assets../dist/file.js`, is now refused rather than served.
