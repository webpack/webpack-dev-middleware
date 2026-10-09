# Changelog

## 8.4.0

### Minor Changes

- The client posts build events to the page the way webpack-dev-server's does (`webpackOk`, `webpackErrors`, `webpackClose` and the rest), logs `Disconnected!` when the connection drops and clears the build's problems from the overlay until it is back. `progress` accepts `"circular"` or `"linear"`. Reloads skip a page that is already navigating away, use the nearest ancestor with a url of its own inside an `about:blank` iframe, and in `apply: "reload"` follow a sibling compilation's build too. (by [@alexander-akait](https://github.com/alexander-akait) in [#2425](https://github.com/webpack/webpack-dev-middleware/pull/2425))

- `hot.client: false` adds no runtime to the page while still applying `HotModuleReplacementPlugin`, which now goes to every compilation the middleware serves, including server bundles that hot-reload through `webpack/hot/poll`. `hot.client.transport` also accepts a module exporting a client class of your own, and the new `hot.ws` option is passed to the `ws` server (compression, `verifyClient`, or a `port` or `server` of its own), with `hot.cors` and `hot.token` still checked. The connection the runtime holds is exported as `webpack-dev-middleware/client/socket` for tooling that listens alongside it. (by [@alexander-akait](https://github.com/alexander-akait) in [#2472](https://github.com/webpack/webpack-dev-middleware/pull/2472))

- Grouped `etag`, `lastModified`, `cacheControl` and `cacheImmutable` into `cache.*`, and `mimeTypes` and `mimeTypeDefault` into `mime.*`; the old names warn and keep working until the next major release, and the grouped name wins when both are set. Media types now resolve through `mime-db` directly, and `mime.types` belongs to its own middleware instead of being written into the table `mime-types` shares with the whole process. `instance.context.options` is a copy of the options passed, `cache.control` included. (by [@alexander-akait](https://github.com/alexander-akait) in [#2455](https://github.com/webpack/webpack-dev-middleware/pull/2455))

- `hot.client.apply` (`"hmr"`, `"hmr-only"`, `"reload"` or `"nothing"`) says what a build does to the page, so a project without HMR still reloads on a change; a single page can choose its own mode with `?webpack-dev-middleware-apply=`, and publishing `{ action: "reload" }` reloads every page. `hot.client.connect` (`false`, or `{ retries, timeout }`) controls connecting and reconnecting, with `retries` honoured on both transports. The `hot`, `liveReload`, `reload`, `autoConnect`, `reconnect` and `timeout` options they replace still work with a deprecation warning until the next major release. (by [@alexander-akait](https://github.com/alexander-akait) in [#2458](https://github.com/webpack/webpack-dev-middleware/pull/2458))

- Added `hot.client`, which sets the browser runtime's options on the middleware under the same names the entry query takes, so a configuration no longer needs a hand-written query string. `path` accepts a url or its parts (`{ port: 8080 }`) and resolves the rest in the page, and `logging` accepts `{ level, name }` so an embedding package can label the console with its own name. (by [@alexander-akait](https://github.com/alexander-akait) in [#2436](https://github.com/webpack/webpack-dev-middleware/pull/2436))

- Added `hot.cors` to choose which origins may reach the hot endpoint: Server-Sent Events still allow every origin until the next major release, while the new WebSocket transport allows only local origins and refuses others with `403` before the handshake. Added `hot.token`, a secret the injected client carries and the endpoint requires, for the case where a browser sends no `Origin`; it is off by default. (by [@alexander-akait](https://github.com/alexander-akait) in [#2444](https://github.com/webpack/webpack-dev-middleware/pull/2444))

- `hot` now adds the client and `HotModuleReplacementPlugin` to the compilation itself, so enabling it is all a webpack configuration needs; `hot.inject: false` turns this off for anyone wiring it by hand. Web workers get a client too, nothing is injected into a non-browser target, and the HMR plugin is left out when `hot.client.apply` is `reload` or `nothing`. (by [@alexander-akait](https://github.com/alexander-akait) in [#2430](https://github.com/webpack/webpack-dev-middleware/pull/2430))

- The instance gains `attach(server)`, `handleUpgrade(req, socket, head)`, `onConnect(fn)` (now given the request as well as the client), `publish(payload)` and `publishTo(client, payload)`, so a server can own the upgrade, decide who may listen and put payloads of its own on the stream, such as `ProgressPlugin` ticks. The client understands `{ action: "error", message }`, logging the reason a server refused it and posting it to the page as `webpackError`. (by [@alexander-akait](https://github.com/alexander-akait) in [#2431](https://github.com/webpack/webpack-dev-middleware/pull/2431))

- `hot.transport` chooses how events reach the browser: Server-Sent Events (the default), `"ws"` for a WebSocket, or a transport of your own, which only needs `onConnect`, `publish`, `publishTo` and `close`. The client speaks both built-in wires, also exported as `webpack-dev-middleware/client/sse` and `webpack-dev-middleware/client/ws`, and behaves the same on either. (by [@alexander-akait](https://github.com/alexander-akait) in [#2420](https://github.com/webpack/webpack-dev-middleware/pull/2420))

- `overlay.id` names the overlay element, so a package embedding it can keep the id its users already query. The new `webpack-dev-middleware/client/problem` export formats one of webpack's errors or warnings with `formatProblem`, and `showProblems` accepts webpack's objects as well as strings. (by [@alexander-akait](https://github.com/alexander-akait) in [#2438](https://github.com/webpack/webpack-dev-middleware/pull/2438))

### Patch Changes

- Bound the internal url and `Range` header caches, which grew for the life of the process and were never released, even by `close()`. (by [@alexander-akait](https://github.com/alexander-akait) in [#2405](https://github.com/webpack/webpack-dev-middleware/pull/2405))

- The client exports ship type declarations and are marked as the ES modules they are. The client logs through webpack's `Logger` without `webpack/lib/logging/runtime.js`, so `universal` and `["web", "node"]` bundles no longer pull in a node builtin and a page enforcing Trusted Types needs no guard. A module that re-exports the client can hand it its options through `__webpack_dev_middleware_client_query__`, and `?autoConnect` is read like every other boolean. (by [@alexander-akait](https://github.com/alexander-akait) in [#2428](https://github.com/webpack/webpack-dev-middleware/pull/2428))

- Deprecated `hot.progress`, which keeps working until the next major release: a server that applies `ProgressPlugin` itself ended up with two on one compiler. Remove it, apply the plugin yourself and hand its ticks to [`publish`](https://github.com/webpack/webpack-dev-middleware#publishpayload); the browser-side `hot.client.progress` is unaffected. (by [@alexander-akait](https://github.com/alexander-akait) in [#2451](https://github.com/webpack/webpack-dev-middleware/pull/2451))

- The client keeps doing what webpack-dev-server's did: (by [@alexander-akait](https://github.com/alexander-akait) in [#2472](https://github.com/webpack/webpack-dev-middleware/pull/2472))
  
  - A page url with a malformed escape no longer stops every update.
  - `apply: "reload"` reloads a reconnected page whose build is out of date.
  - A build's warnings are logged and posted along with its errors.
  - An entry written for that server's query (`hostname`, `port`, `pathname`, `live-reload`, `hot=only`) still connects, with no deprecation warning for that server's own spelling.
  - The published client is ES5 down to the logger.
  - The overlay sits at the highest `z-index` and closes on `Esc`.
  - The building indicator works without Shadow DOM and is announced as a progress bar.

- The overlay takes focus when it opens and gives it back when it closes, keeps an uncaught runtime error through a successful build, passes a rejected value to `runtimeErrors` filters as `error.cause`, and no longer shows an empty card or leaves the building indicator up after a multi-compiler build. File references in absolute, Windows and `file://` stack frames are now clickable. The ANSI-to-HTML conversion is built in, dropping `ansi-html-community` and fixing its handling of combined, short and unbalanced sequences. (by [@alexander-akait](https://github.com/alexander-akait) in [#2437](https://github.com/webpack/webpack-dev-middleware/pull/2437))

- Validate options with a precompiled schema to cut ~155ms from startup. (by [@alexander-akait](https://github.com/alexander-akait) in [#2413](https://github.com/webpack/webpack-dev-middleware/pull/2413))

- Hardened the path-traversal guards in `getFilenameFromUrl`: the remainder left after the `publicPath` prefix is stripped is checked for `..` on its own, before it is joined onto the output root. A `..` that leaves the output root and comes back into it, such as `/assets../dist/file.js`, is now refused rather than served. (by [@alexander-akait](https://github.com/alexander-akait) in [#2445](https://github.com/webpack/webpack-dev-middleware/pull/2445))

## 8.3.0

### Minor Changes

- Added a `hot` option that enables hot module replacement, replacing the need for `webpack-hot-middleware`. Pass `hot: true` to enable with defaults, or `hot: { path, heartbeat, progress, statsOptions }` to customize. The client runtime is served by the middleware itself. (by [@bjohansebas](https://github.com/bjohansebas) in [#2370](https://github.com/webpack/webpack-dev-middleware/pull/2370))

- Take the diagnostics a hot payload carries from the `stats` option, so one setting governs what a build reports in the terminal and in the browser: `stats: "errors-only"` keeps warnings out of both, and `stats: false` keeps errors and warnings out of both, the client's error overlay included — reach for the client's `?logging=` or `?overlay=` to quiet the browser alone. `hot.statsOptions` is deprecated and will be removed in the next major release; its `hash`, `timings` and `children` keys are now ignored, because they could leave a payload without the hash the client compares, or carry a child compilation's hash instead, which stopped updates applying and forced a full page reload on every rebuild. (by [@alexander-akait](https://github.com/alexander-akait) in [#2392](https://github.com/webpack/webpack-dev-middleware/pull/2392))

### Patch Changes

- Fixed a crash when calling `invalidate()` in plugin mode (`isPlugin = true`). Since the host (webpack-cli, webpack-dev-server, etc.) owns `compiler.watch()`, the middleware now invalidates the host's `watching` instead (each child compiler's one for a `MultiCompiler` on webpack < 5.109). When nothing is watching it logs a warning and completes the callback, as `close()` does, rather than leaving `invalidate(callback)` waiting on a build that never runs. (by [@bjohansebas](https://github.com/bjohansebas) in [#2378](https://github.com/webpack/webpack-dev-middleware/pull/2378))

- Reject with `403 Forbidden` the requests whose resolved filename falls outside `outputPath` ([GHSA-g84c-rxfj-3j2c](https://github.com/webpack/webpack-dev-middleware/security/advisories/GHSA-g84c-rxfj-3j2c)). With a `publicPath` without a trailing slash, a sibling path sharing its prefix (`/assets../secret`) escaped the output root once the prefix was stripped and joined. (by [@bjohansebas](https://github.com/bjohansebas) in [#2404](https://github.com/webpack/webpack-dev-middleware/pull/2404))

- Update the changelog generator to the `@changesets/get-github-info` 1.0 API. (by [@alexander-akait](https://github.com/alexander-akait) in [#2396](https://github.com/webpack/webpack-dev-middleware/pull/2396))

- Update dependencies. (by [@alexander-akait](https://github.com/alexander-akait) in [#2394](https://github.com/webpack/webpack-dev-middleware/pull/2394))

## 8.2.0

### Minor Changes

- Added a `hot` option that enables hot module replacement, replacing the need for `webpack-hot-middleware`. Pass `hot: true` to enable with defaults, or `hot: { path, heartbeat, progress, statsOptions }` to customize. The client runtime ships with the package and is added as a webpack entry. (by [@bjohansebas](https://github.com/bjohansebas) in [#2322](https://github.com/webpack/webpack-dev-middleware/pull/2322))

## 8.1.1

### Patch Changes

- Fixed a crash when calling `close()` in plugin mode (`isPlugin = true`). Since the host (webpack-cli, webpack-dev-server, etc.) owns `compiler.watch()`, the middleware has no `watching` of its own to close, so `close()` now just calls the callback instead of throwing. (by [@bjohansebas](https://github.com/bjohansebas) in [#2347](https://github.com/webpack/webpack-dev-middleware/pull/2347))

## 8.1.0

### Minor Changes

- Reuse an already active `MultiCompiler` watching session instead of starting a duplicate one (requires webpack >= 5.109). (by [@bjohansebas](https://github.com/bjohansebas) in [#2371](https://github.com/webpack/webpack-dev-middleware/pull/2371))

## 8.0.4

### Patch Changes

- Replace the `on-finished` dependency with Node.js built-in `stream.finished`. (by [@bjohansebas](https://github.com/bjohansebas) in [#2346](https://github.com/webpack/webpack-dev-middleware/pull/2346))

## 8.0.3

### Patch Changes

- Respect `req.url` when modified by middleware such as `connect-history-api-fallback`. (by [@bjohansebas](https://github.com/bjohansebas) in [#2304](https://github.com/webpack/webpack-dev-middleware/pull/2304))

## 8.0.2

### Patch Changes

- Fixed compatibility with rspack. (by [@alexander-akait](https://github.com/alexander-akait) in [#2295](https://github.com/webpack/webpack-dev-middleware/pull/2295))

## 8.0.1

### Patch Changes

- Fixed compatibility with rspack. (by [@alexander-akait](https://github.com/alexander-akait) in [`0b40cfd`](https://github.com/webpack/webpack-dev-middleware/commit/0b40cfd61b7ede0a3ce489295f3bef683e2c3ca3))

## 8.0.0

### Major Changes

- The `getFilenameFromUrl` function is now asynchronous, returning a Promise that resolves to the object with the found `filename` (or `undefined` if the file was not found) or throws an error if the URL cannot be processed. Additionally, the object contains the `extra` property with `stats` (file system stats) and `outputFileSystem` (output file system where file was found) properties. (by [@alexander-akait](https://github.com/alexander-akait) in [#2284](https://github.com/webpack/webpack-dev-middleware/pull/2284))

- Minimum supported `Node.js` version is `20.9.0`. (by [@alexander-akait](https://github.com/alexander-akait) in [#2284](https://github.com/webpack/webpack-dev-middleware/pull/2284))

- Minimum supported `webpack` version is `5.101.0`. (by [@alexander-akait](https://github.com/alexander-akait) in [#2284](https://github.com/webpack/webpack-dev-middleware/pull/2284))

### Minor Changes

- Added support for plugin usage, useful when the middleware will be used as a webpack plugin (no stats output, no extra actions). (by [@alexander-akait](https://github.com/alexander-akait) in [#2284](https://github.com/webpack/webpack-dev-middleware/pull/2284))

- Added the `forwardError` option to enable error forwarding to next middleware. (by [@alexander-akait](https://github.com/alexander-akait) in [#2284](https://github.com/webpack/webpack-dev-middleware/pull/2284))

- Enable `cacheImmutable` by default for immutable assets. (by [@alexander-akait](https://github.com/alexander-akait) in [#2284](https://github.com/webpack/webpack-dev-middleware/pull/2284))

### Patch Changes

- Improved initial loading module time. (by [@alexander-akait](https://github.com/alexander-akait) in [#2284](https://github.com/webpack/webpack-dev-middleware/pull/2284))

- Removed outdated code and improved performance by avoiding extra loops. (by [@alexander-akait](https://github.com/alexander-akait) in [#2284](https://github.com/webpack/webpack-dev-middleware/pull/2284))

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [7.4.5](https://github.com/webpack/webpack-dev-middleware/compare/v7.4.4...v7.4.5) (2025-09-24)

### Bug Fixes

- unpin memfs ([#2176](https://github.com/webpack/webpack-dev-middleware/issues/2176)) ([c9a0e68](https://github.com/webpack/webpack-dev-middleware/commit/c9a0e682d3e57d88030bad264a30a1887a892ce7))

### [7.4.4](https://github.com/webpack/webpack-dev-middleware/compare/v7.4.3...v7.4.4) (2025-09-23)

### Bug Fixes

- pin memfs version ([#2174](https://github.com/webpack/webpack-dev-middleware/issues/2174)) ([044d691](https://github.com/webpack/webpack-dev-middleware/commit/044d69137593a6f7059b995a420526ba6c03394b))

### [7.4.3](https://github.com/webpack/webpack-dev-middleware/compare/v7.4.2...v7.4.3) (2025-09-05)

### Bug Fixes

- do not call the next middleware for 304 responses ([#2155](https://github.com/webpack/webpack-dev-middleware/issues/2155)) ([c26a326](https://github.com/webpack/webpack-dev-middleware/commit/c26a32679c6f4f74895011c4cab4e6d3e2d4cbf4))
- do not call the next middleware when request is finished or errored ([#2156](https://github.com/webpack/webpack-dev-middleware/issues/2156)) ([116c680](https://github.com/webpack/webpack-dev-middleware/commit/116c680de72f726a25201195d2100d81d696e4ac))

### [7.4.2](https://github.com/webpack/webpack-dev-middleware/compare/v7.4.1...v7.4.2) (2024-08-21)

### Bug Fixes

- no crash when headers are already sent ([#1929](https://github.com/webpack/webpack-dev-middleware/issues/1929)) ([c20f1d9](https://github.com/webpack/webpack-dev-middleware/commit/c20f1d98dff9b51931fae44a44fbc53387768673))

### [7.4.1](https://github.com/webpack/webpack-dev-middleware/compare/v7.4.0...v7.4.1) (2024-08-20)

### Bug Fixes

- `assetsInfo` may be undefined (rspack) ([#1927](https://github.com/webpack/webpack-dev-middleware/issues/1927)) ([21f1797](https://github.com/webpack/webpack-dev-middleware/commit/21f1797ee8aecdae7a2bfb0f8b06ce88e987dfb8))

## [7.4.0](https://github.com/webpack/webpack-dev-middleware/compare/v7.3.0...v7.4.0) (2024-08-15)

### Features

- added the cacheImmutable option to cache immutable assets (assets with a hash in file name like `image.e12ab567.jpg`) ([5ed629d](https://github.com/webpack/webpack-dev-middleware/commit/5ed629da0d432fefdd3b5191985ce93c3aab2624))
- allow to configure the `Cache-Control` header ([#1923](https://github.com/webpack/webpack-dev-middleware/issues/1923)) ([f7529c3](https://github.com/webpack/webpack-dev-middleware/commit/f7529c3188efa1885593993d912155ef2188fda5))

### Bug Fixes

- support `devServer: false` ([b443f4d](https://github.com/webpack/webpack-dev-middleware/commit/b443f4df9f38502b73707073a6e2a21e1a9c684a))

## [7.3.0](https://github.com/webpack/webpack-dev-middleware/compare/v7.2.1...v7.3.0) (2024-07-18)

### Features

- support hono ([#1890](https://github.com/webpack/webpack-dev-middleware/issues/1890)) ([0f9f398](https://github.com/webpack/webpack-dev-middleware/commit/0f9f3983b6e342e39032a585a64a4c638f8bfbfd))

### [7.2.1](https://github.com/webpack/webpack-dev-middleware/compare/v7.2.0...v7.2.1) (2024-04-02)

### Bug Fixes

- avoid extra log

## [7.2.0](https://github.com/webpack/webpack-dev-middleware/compare/v7.1.1...v7.2.0) (2024-03-29)

### Features

- hapi support ([b3f9126](https://github.com/webpack/webpack-dev-middleware/commit/b3f9126cfb659c95c0cd77d97eed168c7941c8a8))
- koa support ([#1792](https://github.com/webpack/webpack-dev-middleware/issues/1792)) ([458c17c](https://github.com/webpack/webpack-dev-middleware/commit/458c17c372a2a1a5a33f8923998dba88d2644135))
- support `ETag` header generation ([#1797](https://github.com/webpack/webpack-dev-middleware/issues/1797)) ([b759181](https://github.com/webpack/webpack-dev-middleware/commit/b75918163284495dae5a2f995c2d93805fccfbd7))
- support `Last-Modified` header generation ([#1798](https://github.com/webpack/webpack-dev-middleware/issues/1798)) ([18e5683](https://github.com/webpack/webpack-dev-middleware/commit/18e56833327084c22c1ee6bdad123095a68d144a))

### [7.1.1](https://github.com/webpack/webpack-dev-middleware/compare/v7.1.0...v7.1.1) (2024-03-21)

### Bug Fixes

- `ContentLength` incorrectly set for empty files ([#1785](https://github.com/webpack/webpack-dev-middleware/issues/1785)) ([0f3e25e](https://github.com/webpack/webpack-dev-middleware/commit/0f3e25e2b0adbc081ba4c7df70467c6ed7bc3a2a))
- improve perf ([#1777](https://github.com/webpack/webpack-dev-middleware/issues/1777)) ([5b47c92](https://github.com/webpack/webpack-dev-middleware/commit/5b47c9294ec612e337f87101a4df1ca011b50ace))
- **types:** make types better ([#1786](https://github.com/webpack/webpack-dev-middleware/issues/1786)) ([e4d183e](https://github.com/webpack/webpack-dev-middleware/commit/e4d183ea6dea1731b69e24d5d5471d876ff6ec3a))

## [7.1.0](https://github.com/webpack/webpack-dev-middleware/compare/v7.0.0...v7.1.0) (2024-03-19)

### Features

- prefer to use `fs.createReadStream` over `fs.readFileSync` to read files ([ab533de](https://github.com/webpack/webpack-dev-middleware/commit/ab533de933c6684218172b86992f35c3ca6c58a4))

### Bug Fixes

- cleaup stream and handle errors ([#1769](https://github.com/webpack/webpack-dev-middleware/issues/1769)) ([1258fdd](https://github.com/webpack/webpack-dev-middleware/commit/1258fdd3d9c175dbacf6bc3b36d5c3c545738f13))
- **security:** do not allow to read files above ([#1771](https://github.com/webpack/webpack-dev-middleware/issues/1771)) ([e10008c](https://github.com/webpack/webpack-dev-middleware/commit/e10008c762e4d5821ed6990348dabf0d4d93a10e))

## [7.0.0](https://github.com/webpack/webpack-dev-middleware/compare/v6.1.1...v7.0.0) (2023-12-26)

### ⚠ BREAKING CHANGES

- minimum supported Node.js version is 18.12.0 (#1694)
- updated memfs@4 (#1693)

### Features

- updated memfs@4 ([#1693](https://github.com/webpack/webpack-dev-middleware/issues/1693)) ([244d9f8](https://github.com/webpack/webpack-dev-middleware/commit/244d9f88daa1e3900e5095c58f6b52a4ee53c061))

- minimum supported Node.js version is 18.12.0 ([#1694](https://github.com/webpack/webpack-dev-middleware/issues/1694)) ([e273d61](https://github.com/webpack/webpack-dev-middleware/commit/e273d61ba774ef464399279f347a540762a9a9d7))

### [6.1.1](https://github.com/webpack/webpack-dev-middleware/compare/v6.1.0...v6.1.1) (2023-05-16)

### Bug Fixes

- **types:** `methods` should be string array ([#1550](https://github.com/webpack/webpack-dev-middleware/issues/1550)) ([41b2f77](https://github.com/webpack/webpack-dev-middleware/commit/41b2f77106358acb7a9d518b17b30016c3a15872))

## [6.1.0](https://github.com/webpack/webpack-dev-middleware/compare/v6.0.2...v6.1.0) (2023-05-03)

### Features

- added `mimeTypeDefault` option ([#1527](https://github.com/webpack/webpack-dev-middleware/issues/1527)) ([503d290](https://github.com/webpack/webpack-dev-middleware/commit/503d290b13f33fbbcde6353e98d28f665310655b))
- added `modifyResponseData` option ([#1529](https://github.com/webpack/webpack-dev-middleware/issues/1529)) ([35dac70](https://github.com/webpack/webpack-dev-middleware/commit/35dac7054ce9004a30e434b909c3837e63e3df7d))

### Bug Fixes

- don't use `memory-fs` when `writeToDisk` is `true` ([#1537](https://github.com/webpack/webpack-dev-middleware/issues/1537)) ([852245e](https://github.com/webpack/webpack-dev-middleware/commit/852245e3ef601827c760596cbd0b19e706ebe3ea))
- faster startup time ([f5f033b](https://github.com/webpack/webpack-dev-middleware/commit/f5f033b2ee03c2255ba759a914e3a1ea86c99cf6))

### [6.0.2](https://github.com/webpack/webpack-dev-middleware/compare/v6.0.1...v6.0.2) (2023-03-19)

### Bug Fixes

- make webpack optional peerDep ([#1488](https://github.com/webpack/webpack-dev-middleware/issues/1488)) ([81c39ba](https://github.com/webpack/webpack-dev-middleware/commit/81c39ba7709da6061335686a0a36b82ba8cab40a))

### [6.0.1](https://github.com/webpack/webpack-dev-middleware/compare/v6.0.0...v6.0.1) (2022-11-28)

### Bug Fixes

- update schema for `index` and `methods` properties ([#1397](https://github.com/webpack/webpack-dev-middleware/issues/1397)) ([cda328e](https://github.com/webpack/webpack-dev-middleware/commit/cda328ecd4692b873d9c09c8b2d0fa4bdfbeffe0))

## [6.0.0](https://github.com/webpack/webpack-dev-middleware/compare/v5.3.3...v6.0.0) (2022-11-20)

### ⚠ BREAKING CHANGES

- minimum supported webpack version is 5.0.0
- minimum supported Nodejs version is 14.15.0

### [5.3.3](https://github.com/webpack/webpack-dev-middleware/compare/v5.3.2...v5.3.3) (2022-05-18)

### Bug Fixes

- types for `Request` and `Response` ([#1271](https://github.com/webpack/webpack-dev-middleware/issues/1271)) ([eeb8aa8](https://github.com/webpack/webpack-dev-middleware/commit/eeb8aa8b116038671b7436173fab1994d4645767))

### [5.3.2](https://github.com/webpack/webpack-dev-middleware/compare/v5.3.1...v5.3.2) (2022-05-17)

### Bug Fixes

- node types ([#1195](https://github.com/webpack/webpack-dev-middleware/issues/1195)) ([d68ab36](https://github.com/webpack/webpack-dev-middleware/commit/d68ab3607a43288dbb6efd9ee748ad3e650625a1))

### [5.3.1](https://github.com/webpack/webpack-dev-middleware/compare/v5.3.0...v5.3.1) (2022-02-01)

### Bug Fixes

- types ([#1187](https://github.com/webpack/webpack-dev-middleware/issues/1187)) ([0f82e1d](https://github.com/webpack/webpack-dev-middleware/commit/0f82e1d6ebb9e11c60dc8ee668dd6f953042ada8))

## [5.3.0](https://github.com/webpack/webpack-dev-middleware/compare/v5.2.2...v5.3.0) (2021-12-16)

### Features

- added types ([a2fa77f](https://github.com/webpack/webpack-dev-middleware/commit/a2fa77f87ad4d9912d08a68624e41380821d4d10))
- removed cjs wrapper ([#1146](https://github.com/webpack/webpack-dev-middleware/issues/1146)) ([b6d53d3](https://github.com/webpack/webpack-dev-middleware/commit/b6d53d3f4d43c4c0e646e8d06355f3b4c9893a4f))

### [5.2.2](https://github.com/webpack/webpack-dev-middleware/compare/v5.2.1...v5.2.2) (2021-11-17)

### Chore

- update `schema-utils` package to `4.0.0` version

### [5.2.1](https://github.com/webpack/webpack-dev-middleware/compare/v5.2.0...v5.2.1) (2021-09-25)

- internal release, no visible changes and features

## [5.2.0](https://github.com/webpack/webpack-dev-middleware/compare/v5.1.0...v5.2.0) (2021-09-24)

### Features

- allow array for `headers` option ([#1042](https://github.com/webpack/webpack-dev-middleware/issues/1042)) ([5a6a3f0](https://github.com/webpack/webpack-dev-middleware/commit/5a6a3f0f8e6b0f8fef33629f0f6fa5bed545a88c))

## [5.1.0](https://github.com/webpack/webpack-dev-middleware/compare/v5.0.0...v5.1.0) (2021-09-09)

### Features

- don't read full file if `Range` header is present ([e8b21f0](https://github.com/webpack/webpack-dev-middleware/commit/e8b21f0979c4807b28f7be45aff0d25cca1585ae))
- output more information on errors ([#1024](https://github.com/webpack/webpack-dev-middleware/issues/1024)) ([7df9e44](https://github.com/webpack/webpack-dev-middleware/commit/7df9e449945a852622135f3f0857599ad7b8af64))

### Bug Fixes

- reduced package size by removing `mem` package ([#1027](https://github.com/webpack/webpack-dev-middleware/issues/1027)) ([0d55268](https://github.com/webpack/webpack-dev-middleware/commit/0d55268478f9cbba122855e2be9d7493350d4d5d))

## [5.0.0](https://github.com/webpack/webpack-dev-middleware/compare/v4.3.0...v5.0.0) (2021-06-02)

### ⚠ BREAKING CHANGES

- minimum supported `Node.js` version is `12.13.0` ([#928](https://github.com/webpack/webpack-dev-middleware/issues/928)) ([4cffeff](https://github.com/webpack/webpack-dev-middleware/commit/4cffeffb5fd07ea79e5a7a5a0cdb3f08f3856c06))

## [4.3.0](https://github.com/webpack/webpack-dev-middleware/compare/v4.2.0...v4.3.0) (2021-05-19)

### Features

- add `getFilenameFromUrl` to API ([#911](https://github.com/webpack/webpack-dev-middleware/issues/911)) ([1edc726](https://github.com/webpack/webpack-dev-middleware/commit/1edc7263ff62cfd6456f35e3cb3c2e30c3ac379a))

### Bug Fixes

- husky config ([#904](https://github.com/webpack/webpack-dev-middleware/issues/904)) ([8a423be](https://github.com/webpack/webpack-dev-middleware/commit/8a423bea3f1641e99c1f6fed56630bfe128b62d8))
- typo depandabot -> dependabot ([#905](https://github.com/webpack/webpack-dev-middleware/issues/905)) ([7062990](https://github.com/webpack/webpack-dev-middleware/commit/7062990a55d21d2e35de832ea593f7b088bf054b))

## [4.2.0](https://github.com/webpack/webpack-dev-middleware/compare/v4.1.0...v4.2.0) (2021-05-10)

### Features

- allow the `headers` option to accept function ([#897](https://github.com/webpack/webpack-dev-middleware/issues/897)) ([966afb3](https://github.com/webpack/webpack-dev-middleware/commit/966afb3e331f09912bb9fc5f403e758f586b1a07))

## [4.1.0](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.4...v4.1.0) (2021-01-15)

### Features

- added the `stats` option ([376cdba](https://github.com/webpack/webpack-dev-middleware/commit/376cdba4b6d3f70414d3d1707f80539b7523e486))

### [4.0.4](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.3...v4.0.4) (2021-01-13)

### Bug Fixes

- compatibility with webpack@4 ([#816](https://github.com/webpack/webpack-dev-middleware/issues/816)) ([acdfd4d](https://github.com/webpack/webpack-dev-middleware/commit/acdfd4d8b671ba98b601ea4d53c7dccea3270e73))

### [4.0.3](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.1...v4.0.3) (2021-01-12)

### Bug Fixes

- output `stats` to `stdout` instead `stderr`, how does `webpack-cli`, if you need hide `stats` from output please use `{ stats: false }` or `{ stats: 'none' }` ([4de0f97](https://github.com/webpack/webpack-dev-middleware/commit/4de0f97596d52a7182ac108a9b9865462fca54fe))
- colors are working for `stats` ([4de0f97](https://github.com/webpack/webpack-dev-middleware/commit/4de0f97596d52a7182ac108a9b9865462fca54fe))
- schema description ([#783](https://github.com/webpack/webpack-dev-middleware/issues/783)) ([f9ce2b2](https://github.com/webpack/webpack-dev-middleware/commit/f9ce2b2537c331901e230c5a8452f4b91d45c713))
- skip `Content-type header` on unknown types ([#809](https://github.com/webpack/webpack-dev-middleware/issues/809)) ([5c9eee5](https://github.com/webpack/webpack-dev-middleware/commit/5c9eee549be264f6df202d960b7cd10bfff7f97d))

### [4.0.2](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.1...v4.0.2) (2020-11-10)

### Bug Fixes

- compatibility with the `headers` option ([#763](https://github.com/webpack/webpack-dev-middleware/issues/763)) ([7c4cac5](https://github.com/webpack/webpack-dev-middleware/commit/7c4cac538dc7facf3c3334863ec3a49b14e16630))

### [4.0.1](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.0...v4.0.1) (2020-11-09)

### Bug Fixes

- compatibility with `connect` ([b83a1db](https://github.com/webpack/webpack-dev-middleware/commit/b83a1db264b4fb50361264cf98f102b34413bfaa))

## [4.0.0](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.0-rc.3...v4.0.0) (2020-10-28)

### ⚠ BREAKING CHANGES

- export in CommonJS format

### Bug Fixes

- compatibility with new webpack@5 API ([#737](https://github.com/webpack/webpack-dev-middleware/issues/737)) ([f6054a0](https://github.com/webpack/webpack-dev-middleware/commit/f6054a00e0e804a9d9ef0f4b3075e6116fae6c99))
- handle the `auto` value of the `publicPath` option ([9b4c5ec](https://github.com/webpack/webpack-dev-middleware/commit/9b4c5ec924d8b25d374b95433191d549f9d3717f))
- support webpack@5 ([#702](https://github.com/webpack/webpack-dev-middleware/issues/702)) ([9ccc327](https://github.com/webpack/webpack-dev-middleware/commit/9ccc3276466754bb10e7f5d0b76f63de2a913e92))

## [4.0.0-rc.3](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.0-rc.2...v4.0.0-rc.3) (2020-07-14)

- internal improvements

## [4.0.0-rc.2](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.0-rc.1...v4.0.0-rc.2) (2020-06-30)

### Bug Fixes

- prefer mime type option over built-in ([#670](https://github.com/webpack/webpack-dev-middleware/issues/670)) ([7fa2c15](https://github.com/webpack/webpack-dev-middleware/commit/7fa2c151cfc84001a0116e07532c464aefe9f56c))

## [4.0.0-rc.1](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.0-rc.0...v4.0.0-rc.1) (2020-02-20)

### Bug Fixes

- missing `options.json` file ([#589](https://github.com/webpack/webpack-dev-middleware/issues/589)) ([41d6264](https://github.com/webpack/webpack-dev-middleware/commit/41d6264e44e2963deab37379a34d8ad8a1140d99))

### [4.0.0-rc.0](https://github.com/webpack/webpack-dev-middleware/compare/v3.7.2...v4.0.0-rc.0) (2020-02-19)

### Bug Fixes

- respect `output.path` and `output.publicPath` options from the configuration
- respect the `stats` option from the configuration
- respect the `watchOptions` option from the configuration
- the `writeToDisk` option now correctly works in multi-compiler mode
- the `outputFileSystem` option now correctly works in multi-compiler mode
- respect `[hash]`/`[fullhash]` in `output.path` and `output.publicPath`
- handle exceptions for filesystem operations
- the `Content-Type` header doesn't have `charset=utf-8` value for custom MIME types and MIME types which can be non `utf-8`

### Features

- validate options
- migrate on the `webpack` logger
- migrate on the `memfs` package
- improve performance

### BREAKING CHANGES

- minimum supported Node.js version is `10.13.0`
- the default value of the option `publicPath` is taken from the value of the `output.publicPath` option from the configuration (`webpack.config.js`)
- the `stats` option was removed, the default value of the `stats` option is taken from the value of the `stats` option from the configuration (`webpack.config.js`)
- the `watchOptions` was removed, the default value of the `watchOptions` option is taken from the value of the `watchOptions` option from the configuration (`webpack.config.js`)
- the `Content-Type` header doesn't have `charset=utf-8` value for custom MIME types and MIME types which can be non `utf-8`
- the `fs` option was renamed to the `outputFileSystem` option
- the `lazy` option was removed without replacement
- the `logger`, `logLevel` and `logTime` options were removed without replacement. You can setup the `level` value using `{ infrastructureLogging: { level: 'warn' } }`, please read https://webpack.js.org/configuration/other-options/#infrastructurelogging. You can use the `infrastructurelog` (`infrastructureLog` in `webpack@5`) hook to customize logs. The `log` property in the middleware context was renamed to `logger`
- the `mimeTypes` option first requires you to specify an extension and then a content-type - `{ mimeTypes: { phtml: 'text/html' } }`
- the `force` option from the `mimeTypes` option was removed without replacement
- the `reporter` option was removed without replacement
- the `getFilenameFromUrl` method was removed from the API
- the middleware `locals` now under `res.locals.webpack` - use `res.locals.webpack.stats` for access `stats` and `res.locals.webpack.outputFileSystem` to access `outputFileSystem`

### [3.7.2](https://github.com/webpack/webpack-dev-middleware/compare/v3.7.1...v3.7.2) (2019-09-28)

### Bug Fixes

- compatibility with webpack@5 ([#473](https://github.com/webpack/webpack-dev-middleware/issues/473)) ([63da9ae](https://github.com/webpack/webpack-dev-middleware/commit/63da9ae))
- memory leak when `writeToDisk` used ([#472](https://github.com/webpack/webpack-dev-middleware/issues/472)) ([6730076](https://github.com/webpack/webpack-dev-middleware/commit/6730076))

### [3.7.1](https://github.com/webpack/webpack-dev-middleware/compare/v3.7.0...v3.7.1) (2019-09-03)

### Bug Fixes

- directly used mkdirp instead of through Webpack ([#436](https://github.com/webpack/webpack-dev-middleware/issues/436)) ([dff39a1](https://github.com/webpack/webpack-dev-middleware/commit/dff39a1))
- displayStats only logged ([#427](https://github.com/webpack/webpack-dev-middleware/issues/427)) ([98deaf4](https://github.com/webpack/webpack-dev-middleware/commit/98deaf4))
- the `writeToFile` option has compatibility with webpack@5 ([#459](https://github.com/webpack/webpack-dev-middleware/issues/459)) ([5c90e1e](https://github.com/webpack/webpack-dev-middleware/commit/5c90e1e))

## [3.7.0](https://github.com/webpack/webpack-dev-middleware/compare/v3.6.2...v3.7.0) (2019-05-15)

### Features

- support `HEAD` method by default ([#398](https://github.com/webpack/webpack-dev-middleware/issues/398)) ([ec3d5eb](https://github.com/webpack/webpack-dev-middleware/commit/ec3d5eb))

<a name="3.6.2"></a>

## [3.6.2](https://github.com/webpack/webpack-dev-middleware/compare/v3.6.1...v3.6.2) (2019-04-03)

### Bug Fixes

- check existence of `res.getHeader` and set the correct Content-Type ([#385](https://github.com/webpack/webpack-dev-middleware/issues/385)) ([56dc705](https://github.com/webpack/webpack-dev-middleware/commit/56dc705))

## [3.6.1](https://github.com/webpack/webpack-dev-middleware/compare/v3.6.0...v3.6.1) (2019-03-06)

### Bug Fixes

- do not overwrite Content-Type if header already exists ([#377](https://github.com/webpack/webpack-dev-middleware/issues/377)) ([b2a6fed](https://github.com/webpack/webpack-dev-middleware/commit/b2a6fed))

<a name="3.5.2"></a>

## [3.5.2](https://github.com/webpack/webpack-dev-middleware/compare/v3.5.1...v3.5.2) (2019-02-06)

### Bug Fixes

- don't add charset to `usdz` file type ([#357](https://github.com/webpack/webpack-dev-middleware/issues/357)) ([b135b3d](https://github.com/webpack/webpack-dev-middleware/commit/b135b3d))

<a name="3.5.1"></a>

## [3.5.1](https://github.com/webpack/webpack-dev-middleware/compare/v3.5.0...v3.5.1) (2019-01-17)

### Bug Fixes

- remove querystring from filenames when writing to disk ([#361](https://github.com/webpack/webpack-dev-middleware/issues/361)) ([90d0d94](https://github.com/webpack/webpack-dev-middleware/commit/90d0d94))

<a name="3.5.0"></a>

# [3.5.0](https://github.com/webpack/webpack-dev-middleware/compare/v3.4.0...v3.5.0) (2019-01-04)

### Bug Fixes

- **middleware:** do not add 'null' to Content-Type ([#355](https://github.com/webpack/webpack-dev-middleware/issues/355)) ([cf4d7a9](https://github.com/webpack/webpack-dev-middleware/commit/cf4d7a9))

### Features

- allow to redefine `mimeTypes` (possible to use `force` option) ([#349](https://github.com/webpack/webpack-dev-middleware/issues/349)) ([e56a181](https://github.com/webpack/webpack-dev-middleware/commit/e56a181))

<a name="3.3.0"></a>

# [3.3.0](https://github.com/webpack/webpack-dev-middleware/compare/v3.2.0...v3.3.0) (2018-09-10)

### Features

- **middleware:** expose the memory filesystem (`response.locals.fs`) ([#337](https://github.com/webpack/webpack-dev-middleware/issues/337)) ([f9a138e](https://github.com/webpack/webpack-dev-middleware/commit/f9a138e))

<a name="3.2.0"></a>

# [3.2.0](https://github.com/webpack/webpack-dev-middleware/compare/v3.1.3...v3.2.0) (2018-08-23)

### Bug Fixes

- **package:** 18 security vulnerabilities ([#329](https://github.com/webpack/webpack-dev-middleware/issues/329)) ([5951de9](https://github.com/webpack/webpack-dev-middleware/commit/5951de9))

### Features

- **middleware:** add `methods` option (`options.methods`) ([#319](https://github.com/webpack/webpack-dev-middleware/issues/319)) ([fe6bb86](https://github.com/webpack/webpack-dev-middleware/commit/fe6bb86))
