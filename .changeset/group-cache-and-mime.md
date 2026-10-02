---
"webpack-dev-middleware": minor
---

Grouped six flat options into `cache` and `mime`:

| before            | now                  |
| ----------------- | -------------------- |
| `etag`            | `cache.etag`         |
| `lastModified`    | `cache.lastModified` |
| `cacheControl`    | `cache.control`      |
| `cacheImmutable`  | `cache.immutable`    |
| `mimeTypes`       | `mime.types`         |
| `mimeTypeDefault` | `mime.default`       |

Four of the sixteen top-level options were the same topic and two more were another, so the list read as an inbox rather than a design. `cacheControl` and `cacheImmutable` also lose their stutter inside the group.

Both spellings work. A legacy name warns and names its replacement, and will be removed in the next major release; when a name is set both ways the grouped one applies, so a migration that sets the new name and forgets to delete the old is not silently ignored. The legacy keys stay on `instance.context.options` for anything reading them.
