---
"webpack-dev-middleware": patch
---

Hardened the path-traversal guards in `getFilenameFromUrl`. The remainder left after the `publicPath` prefix is stripped is now checked for `..` on its own, before it is joined onto the output root.

The existing `..` guard tests the whole request path _normalized_, which catches far less than it appears to: `/public/../secret` normalizes to `secret` with no `..` segment left to match, and `/assets../secret` never had a `..` segment to begin with — it is a sibling sharing the prefix, which a `publicPath` with no trailing slash makes possible. Both of those were left to the containment check on the final resolved path, so a single check stood between two classes of traversal and the output root. There are now two independent guards: one on the shape of the request, one on where it resolved.

A `..` that walks out of the output root and back into it — `/assets../dist/file.js`, which resolves to a file that is inside — is now refused rather than served. It was only ever a second spelling of a path reachable directly, and one whose shape cannot be told apart from an escape.
