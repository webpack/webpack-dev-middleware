---
"webpack-dev-middleware": minor
---

Extensions resolve through `mime-db` directly, rather than through
`mime-types`. `mime-db` is the data, and webpack itself already depends on it
and scores it the same way, so a webpack project now installs one package here
instead of two over the same table. Every extension in `mime-db` resolves to
the byte-identical media type, `Content-Type` and charset it did before.

The table is also built per middleware instance now. The `mimeTypes` option
used to be applied by writing into the table `mime-types` exports, which is
one object shared by everything in the process that requires it: two
middlewares accumulated into a single map rather than each keeping its own,
and anything else using `mime-types` inherited whatever a middleware had
registered. The option is read ahead of the known extensions instead, so it
belongs to the instance it was given to and the database is left alone.
