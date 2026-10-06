---
"webpack-dev-middleware": minor
---

pr: #2455

Grouped `etag`, `lastModified`, `cacheControl` and `cacheImmutable` into `cache.*`, and `mimeTypes` and `mimeTypeDefault` into `mime.*`; the old names warn and keep working until the next major release, and the grouped name wins when both are set. Media types now resolve through `mime-db` directly, and `mime.types` belongs to its own middleware instead of being written into the table `mime-types` shares with the whole process. `instance.context.options` is a copy of the options passed, `cache.control` included.
