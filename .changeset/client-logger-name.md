---
"webpack-dev-middleware": minor
---

`hot.client.logging` takes an object as well as a level, so a package embedding this runtime can label the console with its own name:

```js
middleware(compiler, {
  hot: { client: { logging: { level: "warn", name: "my-dev-server" } } },
});
```

Messages read `[my-dev-server] …` rather than `[webpack-dev-middleware] …`. Unset, it is this package's name as before.

The reason is the one that made the overlay's element id an option: the package a developer installed is the one they would report a problem to, and a console labelled with a dependency's name sends them to the wrong repository. It matters most where this runtime is the whole of another package's client — webpack-dev-server, whose users have read `[webpack-dev-server]` for years.
