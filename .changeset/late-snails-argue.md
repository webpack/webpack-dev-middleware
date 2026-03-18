---
"webpack-dev-middleware": major
---

The `getFilenameFromUrl` function now returns an object with the found `filename` (or `undefined` if the file was not found) and throws an error if the URL cannot be processed. Additionally, the object contains the `extra` property with `stats` (file system stats) and `outputFileSystem` (output file system where file was found) properties.
