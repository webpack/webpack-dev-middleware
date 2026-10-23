---
"webpack-dev-middleware": minor
---

Added support for `multipart/byteranges` responses. A `Range` header with several separate ranges now returns a `206` with one part per range instead of the whole file. Requests with more than 200 ranges, or ranges that cover the whole file, still get a normal `200`.
