---
"webpack-dev-middleware": minor
---

`hot.client.path` now takes the parts of a url as well as a finished one, and resolves the rest in the page:

```js
middleware(compiler, {
  hot: { client: { path: { port: 8080 } } },
});
```

An absolute url says everything, which is more than is usually known where the options are written: which host a page will be opened on, and which scheme it was served over, are the browser's to report. A server behind a proxy, on another host, or with a socket listening on a port of its own needs to say the part that differs and leave the rest to be worked out where it is known.

`protocol`, `hostname`, `port`, `pathname`, `username` and `password` are each optional. Unset, each comes from the page — and so do the values that only a server could have meant: `0.0.0.0` and `::` are what listening on every interface reports and are not addresses a page can connect to, and a port of `0` is one the server picked. `"auto"` asks for the page's protocol explicitly.

Only whether the protocol is the secure one carries over, since the two transports do not share a scheme: `"sse"` connects over `http`/`https` and `"ws"` over `ws`/`wss`, and an `EventSource` pointed at `ws://` never connects. A page served over TLS always gets a secure connection, because a browser refuses a plaintext one from it.

This is the url resolution webpack-dev-server has done in its own client, ported with its test cases, so a server built on this middleware no longer needs a client of its own to do it.
