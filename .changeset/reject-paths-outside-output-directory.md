---
"webpack-dev-middleware": patch
---

Reject with `403 Forbidden` the requests whose resolved filename falls outside `outputPath` ([GHSA-g84c-rxfj-3j2c](https://github.com/webpack/webpack-dev-middleware/security/advisories/GHSA-g84c-rxfj-3j2c)). With a `publicPath` without a trailing slash, a sibling path sharing its prefix (`/assets../secret`) escaped the output root once the prefix was stripped and joined.
