# Migrating from `webpack-hot-middleware`

`webpack-dev-middleware` serves hot module replacement itself, through the
[`hot`](README.md#hot) option. One middleware now serves both the bundle and the
Server-Sent Events endpoint that drives the browser, so `webpack-hot-middleware`
is no longer needed alongside it.

The endpoint (`/__webpack_hmr`) and its Server-Sent Events transport are
unchanged, so the browser reaches the new server the same way it reached the old
one. The payloads, the option names and a few defaults are not identical:
[section 5](#5-behavior-differences-to-expect) lists what changed, and the tables
in [section 4](#4-map-your-options) map every option across.

**Contents**

- [Before you start](#before-you-start)
- [1. Swap the packages](#1-swap-the-packages)
- [2. Server: one middleware instead of two](#2-server-one-middleware-instead-of-two)
- [3. webpack config: swap the client entry](#3-webpack-config-swap-the-client-entry)
- [4. Map your options](#4-map-your-options)
- [5. Behavior differences to expect](#5-behavior-differences-to-expect)
- [6. Programmatic API](#6-programmatic-api)
- [7. What you gain](#7-what-you-gain)
- [Troubleshooting](#troubleshooting)
- [Checklist](#checklist)

## Before you start

`webpack-hot-middleware` declares no `engines` and no webpack peer dependency, so
it runs on much older setups than `webpack-dev-middleware` does. Check these
first:

| Requirement            | Needed                                       |
| :--------------------- | :------------------------------------------- |
| Node.js                | >= 20.9.0                                    |
| webpack                | ^5.101.0                                     |
| webpack-dev-middleware | a version that has `hot` (see the CHANGELOG) |
| Configuration          | `HotModuleReplacementPlugin`, as before      |

If you are pinned to an older Node.js or to webpack 4, stay on
`webpack-hot-middleware` for now.

## 1. Swap the packages

Removing the old package does not upgrade the one that replaces it, so do both:

```console
npm uninstall webpack-hot-middleware
npm install --save-dev webpack-dev-middleware@latest
```

Nothing else to install: `hot` is part of `webpack-dev-middleware`, and the
browser runtime ships in the same package under `webpack-dev-middleware/client`.

A version that predates the option rejects it at startup rather than ignoring
it, so a missed upgrade is loud:

```text
Invalid options object. Dev Middleware has been initialized using an options object that does not match the API schema.
 - options has an unknown property 'hot'. These properties are valid:
   object { mimeTypes?, mimeTypeDefault?, ... }
```

## 2. Server: one middleware instead of two

```js
// Before
const webpackDevMiddleware = require("webpack-dev-middleware");
const webpackHotMiddleware = require("webpack-hot-middleware");

app.use(webpackDevMiddleware(compiler));
app.use(webpackHotMiddleware(compiler, { heartbeat: 2000 }));
```

```js
// After
const webpackDevMiddleware = require("webpack-dev-middleware");

app.use(webpackDevMiddleware(compiler, { hot: { heartbeat: 2000 } }));
```

`hot: true` takes the defaults. Because there is only one middleware, the
ordering problem — hot middleware had to be registered after dev middleware —
disappears.

### Other frameworks

`webpack-hot-middleware` pointed Koa and hapi users at third-party wrappers.
`webpack-dev-middleware` has its own, and each carries the `hot` option:

```js
// Koa
app.use(webpackDevMiddleware.koaWrapper(compiler, { hot: true }));
// hono
app.use(webpackDevMiddleware.honoWrapper(compiler, { hot: true }));
// hapi
await server.register({
  plugin: webpackDevMiddleware.hapiWrapper(),
  options: { compiler, hot: true },
});
```

See [Other servers](README.md#other-servers) for connect, router, fastify and the
rest.

## 3. webpack config: swap the client entry

```js
// Before
module.exports = {
  entry: ["webpack-hot-middleware/client?timeout=20000", "./src/app.js"],
  plugins: [new webpack.HotModuleReplacementPlugin()],
};

// After
module.exports = {
  entry: ["webpack-dev-middleware/client?timeout=20000", "./src/app.js"],
  plugins: [new webpack.HotModuleReplacementPlugin()],
};
```

With [multiple entry points](https://webpack.js.org/concepts/entry-points/), add
the client to each one, exactly as before:

```js
module.exports = {
  entry: {
    vendor: ["webpack-dev-middleware/client", "jquery"],
    index: ["webpack-dev-middleware/client", "./src/index.js"],
  },
};
```

Multiple entries on one page share a single SSE connection.

### Multi-compiler

Unchanged: give each configuration a `name` and pass the same value to its
client, so a bundle only applies its own updates.

```js
module.exports = [
  {
    name: "app",
    entry: ["webpack-dev-middleware/client?name=app", "./src/app.js"],
  },
  {
    name: "admin",
    entry: ["webpack-dev-middleware/client?name=admin", "./src/admin.js"],
  },
];
```

## 4. Map your options

### Server options

| webpack-hot-middleware | webpack-dev-middleware                                                                                                                                                                                                                                                                                                                                                                                 |
| :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`                 | `hot.path` — unchanged (`/__webpack_hmr`). Must start with `/` and carry no query string or fragment; an invalid value is now rejected at startup instead of silently never matching.                                                                                                                                                                                                                  |
| `heartbeat`            | `hot.heartbeat` — unchanged (`10000`). Must be `1` or greater.                                                                                                                                                                                                                                                                                                                                         |
| `statsOptions`         | Use the middleware's [`stats`](README.md#stats) option, which decides whether the payload carries errors and warnings just as it decides what the terminal prints. `hot.statsOptions` still works but is deprecated and removed in the next major; the payload is fixed (`name`, `action`, `time`, `hash`, `errors`, `warnings`) and `hash`, `timings` and `children` cannot be overridden either way. |
| `log`                  | Removed. The middleware logs through the compiler's [infrastructure logger](https://webpack.js.org/configuration/infrastructurelogging/); use `infrastructureLogging.level` to quiet it.                                                                                                                                                                                                               |

New: [`hot.progress`](README.md#hotprogress) publishes compilation progress to
the clients.

### Client options

Set through the entry's query string, as before.

| webpack-hot-middleware    | webpack-dev-middleware                                                                                                                                                     |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`, `timeout`, `name` | Unchanged.                                                                                                                                                                 |
| `autoConnect`             | Unchanged.                                                                                                                                                                 |
| `dynamicPublicPath`       | Unchanged, but the leading slash of `path` is now stripped before joining, so `publicPath: "/assets/"` gives `/assets/__webpack_hmr` rather than `/assets//__webpack_hmr`. |
| `reload`                  | Unchanged — but the default flipped to `true`. Pass `reload=false` to keep the old HMR-only behavior.                                                                      |
| `noInfo`                  | `logging=warn`                                                                                                                                                             |
| `quiet`                   | `logging=none`                                                                                                                                                             |
| `overlay`                 | `overlay` — still a boolean, and now also an object (below).                                                                                                               |
| `overlayWarnings`         | `overlay.warnings` — **on by default now**; pass `overlay={"warnings":false}` for the old behavior.                                                                        |
| `overlayStyles`           | `overlay.styles`                                                                                                                                                           |
| `ansiColors`              | `overlay.ansiColors`                                                                                                                                                       |

New: [`progress`](README.md#client-options) shows a rebuild badge in the page,
and the overlay gained `runtimeErrors`, `paginate`, `openEditorEndpoint` and
`trustedTypesPolicyName` — see [client `overlay` options](README.md#client-overlay-options).

### The encoded object options

`overlayStyles` and `ansiColors` used to be separate URI-encoded JSON params.
They are now keys of one `overlay` object:

```js
// Before
const styles = { color: "#FF0000" };
const colors = { red: "00FF00" };

const before =
  "webpack-hot-middleware/client" +
  `?overlayStyles=${encodeURIComponent(JSON.stringify(styles))}` +
  `&ansiColors=${encodeURIComponent(JSON.stringify(colors))}` +
  "&overlayWarnings=true";

// After
const overlay = {
  styles: { color: "#FF0000" },
  ansiColors: { red: "00FF00" },
  warnings: true,
};

const after = `webpack-dev-middleware/client?overlay=${encodeURIComponent(
  JSON.stringify(overlay),
)}`;
```

## 5. Behavior differences to expect

Everything here is deliberate; each one has bitten someone during a migration.

- **A failed update reloads the page by default.** `reload` now defaults to
  `true`, so a build that HMR cannot apply ends in a full reload instead of a
  console warning. Pass `reload=false` to keep the old behavior.
- **Warnings appear in the overlay.** `overlayWarnings` defaulted to `false`;
  the overlay now shows warnings unless you pass `overlay={"warnings":false}`.
- **The payload no longer carries `modules`.** `webpack-hot-middleware` sent a
  map of module id to name with every build, which also forced `modules: true`
  in the stats it computed. The payload is now `{ name, action, time, hash,
errors, warnings }`. Only [`subscribeAll`](#6-programmatic-api) consumers that
  read `payload.modules` are affected — and rebuilds serialize less.
- **Unchanged bundles publish `sync`, not `built`.** In a multi-compiler build,
  a bundle whose hash did not change no longer tells its clients to fetch a
  hot-update manifest that was never emitted.
- **`building` events carry `name` and `file`.** They say which compilation
  invalidated and which file triggered it.
- **The endpoint answers `GET` only.** Other methods fall through to the normal
  middleware pipeline rather than opening a stream.
- **Server logging goes through webpack.** `webpack built <hash> in <n>ms` lines
  came from hot middleware's own `log`; build reporting is now the dev
  middleware's [`stats`](README.md#stats) option and the infrastructure logger.

## 6. Programmatic API

The client keeps every name, and adds `disconnect()`:

```js
const hotClient = require("webpack-dev-middleware/client");

hotClient.subscribeAll((payload) => {}); // every message
hotClient.subscribe((payload) => {}); // unrecognized `action`s only
hotClient.useCustomOverlay(myOverlay);
hotClient.setOptionsAndConnect({ path: "/__hmr" }); // with autoConnect=false
hotClient.disconnect(); // new
```

On the server, publishing a custom event moves from the middleware to the hot
instance on the context:

```js
// Before
const hotMiddleware = webpackHotMiddleware(compiler);
hotMiddleware.publish({ action: "reload-all" });

// After
const instance = webpackDevMiddleware(compiler, { hot: true });
instance.context.hot.publish({ action: "reload-all" });
```

`hotMiddleware.close()` has no replacement of its own: `instance.close()` tears
down the SSE clients along with the watcher.

## 7. What you gain

Worth knowing about once the migration works:

- **A rebuild indicator**, optionally with a percentage — server
  [`hot.progress`](README.md#hotprogress) plus the client `progress` option.
- **An overlay at parity with webpack-dev-server**: runtime errors, per-problem
  pagination, click-to-open file references, Trusted Types support.
- **Reusable pieces**: `webpack-dev-middleware/client/overlay` and
  `webpack-dev-middleware/client/indicator` can be driven by other tooling on the
  page, and they share one overlay and one badge between every copy loaded.
- **An ES5 client**, so an old browser can at least parse it (`EventSource` and
  `Promise` are still required — both are needed by HMR itself).
- **First-party framework wrappers** instead of third-party bridges.

## Troubleshooting

Most of `webpack-hot-middleware`'s troubleshooting applies unchanged.

- **Browsers without `EventSource`** need a
  [polyfill](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events#tools);
  the client warns and stays idle without one.
- **Gzip buffers the event stream.** Exclude the endpoint from compression — the
  response sets `X-Accel-Buffering: no` for nginx, but an in-process gzip
  middleware still has to be told.
- **Auto-restarting servers** (nodemon and friends) restart the compiler on every
  change, so clients reconnect and rebuild from scratch. Reload your routes
  without restarting the process, or run the bundler in a separate one.
- **Many open tabs** exhaust the ~6 connections per origin HTTP/1.1 allows. See
  [Browser connection limits](README.md#browser-connection-limits-many-tabs).

## Checklist

- [ ] `webpack-hot-middleware` removed from `package.json`
- [ ] `webpackHotMiddleware(...)` `app.use` call removed
- [ ] `hot: true` (or an options object) passed to `webpack-dev-middleware`
- [ ] every entry's `webpack-hot-middleware/client` swapped for `webpack-dev-middleware/client`
- [ ] query-string options renamed per the tables above
- [ ] `HotModuleReplacementPlugin` still in `plugins`
- [ ] `publish` calls moved to `instance.context.hot.publish`
- [ ] edited a module and watched it apply without a reload
