---
"webpack-dev-middleware": minor
---

Answer a `Range` header with more than one range with `206 Partial Content` and a `multipart/byteranges` body, instead of the whole file. Each part carries its own `Content-Type` and `Content-Range`; ranges that overlap or touch are merged first, and the parts come in the order the ranges were asked for. When the output file system can stream, each range is read on its own, so asking for a few slices of a large asset reads only those; without `createReadStream`, or when a strong `ETag` has already read the file, the parts are cut from the whole file. A request for more than 200 ranges gets the whole file, as before. `modifyResponseData` receives that body as a `Readable`, so its `data` (and the `data` it returns) is typed `Buffer | Readable`, which still includes a `ReadStream`.
