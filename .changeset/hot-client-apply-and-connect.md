---
"webpack-dev-middleware": minor
---

Two unions on the browser options, replacing six with two.

`hot.client.apply` replaces `hot`, `liveReload` and `reload`. Only four of their eight combinations ever differed — `liveReload` was read only when HMR was off, `reload` only when it was on — so the three booleans were one decision written three ways:

| before                          | now                 |
| ------------------------------- | ------------------- |
| `hot: true, reload: true`       | `apply: "hmr"`      |
| `hot: true, reload: false`      | `apply: "hmr-only"` |
| `hot: false, liveReload: true`  | `apply: "reload"`   |
| `hot: false, liveReload: false` | `apply: "nothing"`  |

The page-url parameter follows it: `?webpack-dev-middleware-apply=nothing` in place of `-hot=false` and `-liveReload=false`, with `=false` still accepted as `nothing`. It is more expressive than before, since a page can now ask for a mode rather than only turn something off.

`hot.client.connect` replaces `autoConnect`, `reconnect` and `timeout`. `false` does not connect on load; an object carries `retries` and `timeout`:

```js
middleware(compiler, {
  hot: { client: { connect: { retries: 3, timeout: 5000 } } },
});
```

Both options shipped after 8.3.0, so there is nothing released to keep working and no aliases are needed.
