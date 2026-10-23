---
"webpack-dev-middleware": minor
---

Answer a `Range` header with more than one range with `206 Partial Content` and a `multipart/byteranges` body, instead of the whole file. Each part carries its own `Content-Type` and `Content-Range`, ranges that overlap or touch are merged first, and each range is streamed from the output file system, so asking for a few slices of a large asset reads only those.
