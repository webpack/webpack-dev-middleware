<div align="center">
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200" src="https://webpack.js.org/assets/icon-square-big.svg">
  </a>
</div>

[![npm][npm]][npm-url]
[![node][node]][node-url]
[![tests][tests]][tests-url]
[![coverage][cover]][cover-url]
[![discussion][discussion]][discussion-url]
[![size][size]][size-url]

# webpack-dev-middleware

An express-style development middleware for use with [webpack](https://webpack.js.org)
bundles and allows for serving of the files emitted from webpack.
This should be used for **development only**.

Some of the benefits of using this middleware include:

- No files are written to disk, rather it handles files in memory
- If files changed in watch mode, the middleware delays requests until compiling
  has completed.
- Supports hot module reload (HMR).

## Getting Started

First thing's first, install the module:

```console
npm install webpack-dev-middleware --save-dev
```

> [!WARNING]
>
> _We do not recommend installing this module globally._

## Usage

```js
const express = require("express");
const webpack = require("webpack");
const middleware = require("webpack-dev-middleware");

const compiler = webpack({
  // webpack options
});

const app = express();

app.use(
  middleware(compiler, {
    // webpack-dev-middleware options
  }),
);

app.listen(3000, () => console.log("Example app listening on port 3000!"));
```

See [below](#other-servers) for an example of use with fastify.

## Options

|                      Name                       |           Type            |                    Default                    | Description                                                                                                          |
| :---------------------------------------------: | :-----------------------: | :-------------------------------------------: | :------------------------------------------------------------------------------------------------------------------- |
|            **[`methods`](#methods)**            |          `Array`          |              `[ 'GET', 'HEAD' ]`              | Allows to pass the list of HTTP request methods accepted by the middleware                                           |
|            **[`headers`](#headers)**            | `Array\|Object\|Function` |                  `undefined`                  | Allows to pass custom HTTP headers on each request.                                                                  |
|              **[`index`](#index)**              |     `boolean\|string`     |                 `index.html`                  | If `false` (but not `undefined`), the server will not respond to requests to the root URL.                           |
|              **[`cache`](#cache)**              |         `Object`          |                  `undefined`                  | How responses are cached: `etag`, `lastModified`, `control`, `immutable`.                                            |
|               **[`mime`](#mime)**               |         `Object`          |                  `undefined`                  | How a file's media type is decided: `types`, `default`.                                                              |
|         **[`publicPath`](#publicpath)**         |         `string`          |                  `undefined`                  | The public path that the middleware is bound to.                                                                     |
|              **[`stats`](#stats)**              | `boolean\|string\|Object` |        `stats` (from a configuration)         | Stats options object or preset name.                                                                                 |
|   **[`serverSideRender`](#serversiderender)**   |         `boolean`         |                  `undefined`                  | Instructs the module to enable or disable the server-side rendering mode.                                            |
|        **[`writeToDisk`](#writetodisk)**        |    `boolean\|Function`    |                    `false`                    | Instructs the module to write files to the configured location on disk as specified in your `webpack` configuration. |
|   **[`outputFileSystem`](#outputfilesystem)**   |         `Object`          | [`memfs`](https://github.com/streamich/memfs) | Set the default file system which will be used by webpack as primary destination of generated files.                 |
| **[`modifyResponseData`](#modifyresponsedata)** |        `Function`         |                  `undefined`                  | Allows to set up a callback to change the response data.                                                             |
|                **[`hot`](#hot)**                |     `boolean\|Object`     |                    `false`                    | Enables a Server-Sent Events endpoint that drives the browser HMR client.                                            |
|       **[`forwardError`](#forwarderror)**       |         `boolean`         |                    `false`                    | Enable or disable forwarding errors to the next middleware.                                                          |

The middleware accepts an `options` Object. The following is a property reference for the Object.

### methods

Type: `Array`  
Default: `[ 'GET', 'HEAD' ]`

This property allows a user to pass the list of HTTP request methods accepted by the middleware\*\*.

### headers

Type: `Array|Object|Function`
Default: `undefined`

This property allows a user to pass custom HTTP headers on each request.
eg. `{ "X-Custom-Header": "yes" }`

or

```js
webpackDevMiddleware(compiler, {
  headers: () => ({
    "Last-Modified": new Date(),
  }),
});
```

or

```js
webpackDevMiddleware(compiler, {
  headers: (req, res, context) => {
    res.setHeader("Last-Modified", new Date());
  },
});
```

or

```js
webpackDevMiddleware(compiler, {
  headers: [
    {
      key: "X-custom-header",
      value: "foo",
    },
    {
      key: "Y-custom-header",
      value: "bar",
    },
  ],
});
```

or

```js
webpackDevMiddleware(compiler, {
  headers: () => [
    {
      key: "X-custom-header",
      value: "foo",
    },
    {
      key: "Y-custom-header",
      value: "bar",
    },
  ],
});
```

### index

Type: `Boolean|String`
Default: `index.html`

If `false` (but not `undefined`), the server will not respond to requests to the root URL.

### mime

Type: `{ types?: Object, default?: String }`
Default: `undefined`

How a file's media type is decided.

```js
app.use(
  middleware(compiler, {
    mime: {
      types: { phtml: "text/html" },
      default: "application/octet-stream",
    },
  }),
);
```

#### `mime.types`

Register custom media types or extension mappings, as `{ extension: 'media/type' }`. See [`mime-db`](https://github.com/jshttp/mime-db) for what is known already.

Registered per instance rather than written into the shared table, so two middlewares in one process cannot reach each other through it.

#### `mime.default`

The media type to fall back on when the content type cannot be determined. Without it such a response carries no `Content-Type` at all.

### cache

Type: `{ etag?: "weak" | "strong", lastModified?: Boolean, control?: Boolean | Number | String | { maxAge?: number, immutable?: boolean }, immutable?: Boolean }`
Default: `undefined`

How responses are cached.

```js
app.use(
  middleware(compiler, {
    cache: { etag: "strong", lastModified: true, immutable: true },
  }),
);
```

#### `cache.etag`

Generate an `ETag` header, `"weak"` or `"strong"`.

#### `cache.lastModified`

Generate a `Last-Modified` header from the file system's last modified value.

#### `cache.control`

Set a `Cache-Control` response header.

**An age is given in milliseconds and sent in seconds**, since `max-age` is defined in seconds — so `control: 60000` sends `max-age=60`. An age above a year is clamped to a year, and a negative one is floored at zero.

| what you pass         | the header                                                                             |
| :-------------------- | :------------------------------------------------------------------------------------- |
| `true`                | `Cache-Control: public, max-age=31536000` — a year                                     |
| `60000`               | `Cache-Control: public, max-age=60`                                                    |
| `"max-age=123456"`    | `Cache-Control: max-age=123456` — used verbatim, no conversion                         |
| `{ maxAge: 60000 }`   | `Cache-Control: public, max-age=60`                                                    |
| `{ immutable: true }` | `Cache-Control: public, max-age=31536000, immutable` — a year when `maxAge` is omitted |

#### `cache.immutable`

Send `Cache-Control: public, max-age=31536000, immutable` for immutable assets — ones with a hash in the file name, such as `image.a4c12bde.jpg`, which can be cached forever because changing their contents changes their name.

Takes preference over [`cache.control`](#cachecontrol) for an asset the build marked immutable.

### `etag`, `lastModified`, `cacheControl`, `cacheImmutable`, `mimeTypes`, `mimeTypeDefault`

> [!WARNING]
>
> Deprecated, and removed in the next major release.

Six options that were the same two topics, now grouped:

| before            | now                  |
| :---------------- | :------------------- |
| `etag`            | `cache.etag`         |
| `lastModified`    | `cache.lastModified` |
| `cacheControl`    | `cache.control`      |
| `cacheImmutable`  | `cache.immutable`    |
| `mimeTypes`       | `mime.types`         |
| `mimeTypeDefault` | `mime.default`       |

Each still applies and warns, naming its replacement. Setting a name both ways applies the grouped one, so a migration that sets the new name and leaves the old in place is not silently ignored.

### publicPath

Type: `String`
Default: `output.publicPath` (from a configuration)

The public path that the middleware is bound to.

_Best Practice: use the same `publicPath` defined in your webpack config. For more information about `publicPath`, please see [the webpack documentation](https://webpack.js.org/guides/public-path)._

### stats

Type: `Boolean|String|Object`
Default: `stats` (from a configuration)

Stats options object or preset name.

### serverSideRender

Type: `Boolean`  
Default: `undefined`

Instructs the module to enable or disable the server-side rendering mode.
Please see [Server-Side Rendering](#server-side-rendering) for more information.

### writeToDisk

Type: `Boolean|Function`  
Default: `false`

If `true`, the option will instruct the module to write files to the configured location on disk as specified in your `webpack` config file.
_Setting `writeToDisk: true` won't change the behavior of the `webpack-dev-middleware`, and bundle files accessed through the browser will still be served from memory._
This option provides the same capabilities as the [`WriteFilePlugin`](https://github.com/gajus/write-file-webpack-plugin/pulls).

This option also accepts a `Function` value, which can be used to filter which files are written to disk.
The function follows the same premise as [`Array#filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter) in which a return value of `false` _will not_ write the file, and a return value of `true` _will_ write the file to disk. eg.

```js
const webpack = require("webpack");

const configuration = {/* Webpack configuration */};
const compiler = webpack(configuration);

middleware(compiler, {
  writeToDisk: (filePath) => /superman\.css$/.test(filePath),
});
```

### outputFileSystem

Type: `Object`  
Default: [memfs](https://github.com/streamich/memfs)

Set the default file system which will be used by webpack as primary destination of generated files.
This option isn't affected by the [writeToDisk](#writeToDisk) option.

You have to provide `.join()` and `mkdirp` method to the `outputFileSystem` instance manually for compatibility with `webpack@4`.

This can be done simply by using `path.join`:

```js
const path = require("node:path");
const mkdirp = require("mkdirp");
const myOutputFileSystem = require("my-fs");
const webpack = require("webpack");

myOutputFileSystem.join = path.join.bind(path); // no need to bind
myOutputFileSystem.mkdirp = mkdirp.bind(mkdirp); // no need to bind

const compiler = webpack({/* Webpack configuration */});

middleware(compiler, { outputFileSystem: myOutputFileSystem });
```

### modifyResponseData

Allows to set up a callback to change the response data.

```js
const webpack = require("webpack");

const configuration = {/* Webpack configuration */};
const compiler = webpack(configuration);

middleware(compiler, {
  // Note - if you send the `Range` header you will have `ReadStream`
  // Also `data` can be `string` or `Buffer`
  modifyResponseData: (req, res, data, byteLength) =>
    // Your logic
    // Don't use `res.end()` or `res.send()` here
    ({ data, byteLength }),
});
```

### hot

Type: `Boolean | Object`
Default: `false`

Enables hot module replacement. The middleware serves an endpoint that publishes the webpack compiler's `building`, `built` and `sync` events, **and puts the browser runtime that listens to them into your bundle**, along with `HotModuleReplacementPlugin`. Turning the option on is the whole of it — there is no entry to add, no plugin to apply and no change to your webpack configuration:

```js
const webpack = require("webpack");
const middleware = require("webpack-dev-middleware");

const compiler = webpack({/* your webpack configuration, unchanged */});

app.use(middleware(compiler, { hot: true }));
```

Whether the events carry errors and warnings follows the [`stats`](#stats) option, so one setting governs what a build reports in the terminal and in the browser — `stats: "errors-only"` keeps warnings out of both, and `stats: false` keeps both out. When `true`, defaults are used; pass an object to customise.

See [Hot Module Replacement client](#hot-module-replacement-client) for which compilations get the runtime, how to configure it, and how to wire it yourself instead.

The object form accepts these options:

|                  Name                  |                              Type                               |      Default       | Description                                                                             |
| :------------------------------------: | :-------------------------------------------------------------: | :----------------: | :-------------------------------------------------------------------------------------- |
|    **[`transport`](#hottransport)**    |                      `string \| function`                       |      `'sse'`       | How events reach the clients.                                                           |
|         **[`path`](#hotpath)**         |                            `string`                             | `'/__webpack_hmr'` | Path the endpoint is served at.                                                         |
|    **[`heartbeat`](#hotheartbeat)**    |                            `number`                             |      `10000`       | Interval (in milliseconds) between keep-alive frames.                                   |
|       **[`server`](#hotserver)**       |                            `object`                             |    `undefined`     | HTTP server the `'ws'` transport answers upgrades on.                                   |
|     **[`progress`](#hotprogress)**     |                            `boolean`                            |      `false`       | Publish compilation progress events to the clients.                                     |
|         **[`cors`](#hotcors)**         | `boolean \| string \| string[] \| RegExp \| function \| object` |     see below      | Which origins may reach the endpoint from a page on another one, over either transport. |
|        **[`token`](#hottoken)**        |                       `boolean \| string`                       |     see below      | A secret the injected client carries and the endpoint requires, over either transport.  |
|       **[`inject`](#hotinject)**       |                            `boolean`                            |       `true`       | Add the client entry and `HotModuleReplacementPlugin`.                                  |
| **[`statsOptions`](#hotstatsoptions)** |                            `object`                             |    `undefined`     | Deprecated — do not use; see [`stats`](#stats).                                         |

#### `hot.transport`

Type: `'sse' | 'ws' | Function`
Default: `'sse'`

How events reach the clients.

`'sse'` serves them as [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) from the middleware itself, which needs nothing else.

`'ws'` serves them over a WebSocket. It needs the optional [`ws`](https://www.npmjs.com/package/ws) package (`npm install ws`), and an HTTP server to answer upgrades on — a handshake is an upgrade the server answers, which the middleware never sees. Give it [`hot.server`](#hotserver), or hand the server over later with the middleware's [`attach`](#attachserver) method:

```js
const server = http.createServer(instance);

instance.attach(server);
```

A plain `GET` on the path under `'ws'` answers `426 Upgrade Required`. A handshake from an origin [`hot.cors`](#hotcors) does not allow is refused with `403`, since a handshake is not subject to CORS and refusing is the only way that option can hold on this wire.

A **function** builds a transport of your own. It is called with the resolved `path` and `heartbeat`, the [`cors`](#hotcors) option as it was given, and a logger, and must return a client stream. Four methods are required:

```js
/**
 * @param {{ path: string, heartbeat: number, cors: CorsOption | undefined }} options
 * @param {Logger} logger
 * @returns {ClientStream}
 */
middleware(compiler, {
  hot: {
    transport: ({ path, heartbeat, cors }, logger) => ({
      // Call `fn` with each client once it has joined. It is what catches a
      // client up with the last hashes, so it can apply the next update.
      onConnect(fn) {},
      // Publish a payload to every client.
      publish(payload) {},
      // Publish a payload to one client, as handed to `onConnect`.
      publishTo(client, payload) {},
      // End every client and stop any timers.
      close() {},
    }),
  },
});
```

A function that returns something missing one of those throws, naming what is absent, rather than failing later from wherever it is first published to.

Four more are optional:

```js
const transport = ({ path, heartbeat }, logger) => ({
  // ...the four above, and any of these:

  // Answer a request on the endpoint's path. Only a transport served over
  // HTTP needs one; without it a request there is answered
  // `426 Upgrade Required`, which is what the built-in WebSocket relies on.
  handler(req, res) {},
  // True while at least one client is connected, so a compilation with none
  // can skip building its payload. Without it, `publish` is called and the
  // transport decides for itself.
  hasClients: () => clients.size > 0,
  // For a transport built on an upgrade, which the middleware never sees.
  attach(server) {},
  detach() {},
});
```

The clients are yours — whatever `onConnect` hands out is what `publishTo` takes back — so in TypeScript name their type through `ClientStreamFactory<T>`:

```ts
import { type ClientStreamFactory } from "webpack-dev-middleware/types/hot";

interface MyClient {
  id: number;
  send: (frame: string) => void;
}

const transport: ClientStreamFactory<MyClient> = ({ path }, logger) => ({
  // ...
  publishTo(client, payload) {
    client.send(JSON.stringify(payload));
  },
});
```

#### `hot.path`

Type: `String`
Default: `'/__webpack_hmr'`

Path the endpoint is served at. Must start with a slash and match the `path` option used by the client.

#### `hot.heartbeat`

Type: `Number`
Default: `10000`

Heartbeat interval (in milliseconds) used to keep the connection alive when no compilation events are produced: keep-alive frames for `'sse'`, pings for `'ws'`. Must be `1` or greater.

#### `hot.server`

Type: `Object`
Default: `undefined`

HTTP server the [`'ws'`](#hottransport) transport answers upgrades on, when it already exists where the middleware is built. Otherwise hand it over later with the middleware's [`attach`](#attachserver) method. Ignored by `'sse'`, which is answered by the middleware itself.

#### `hot.progress`

Type: `Boolean`
Default: `false`

> [!WARNING]
>
> Deprecated, and removed in the next major release. Use [`publish`](#publishpayload) instead — the example is there.

Applies webpack's `ProgressPlugin` and publishes what it reports (`{ action: "progress", percent, message }`). The bundled client shows the percentage in its building badge, which the client `progress` option configures.

Deciding to measure a build is the server's call rather than the middleware's, and a server that applies `ProgressPlugin` already — webpack-dev-server does — ends up with two of them on one compiler. The client still renders the payload; what changes is who sends it.

#### `hot.cors`

Type: `Boolean | String | RegExp | (String | RegExp)[] | Function | { origin }`
Default: `true` for [`'sse'`](#hottransport), the local origins for [`'ws'`](#hottransport)

Which origins may reach the endpoint from a page on another origin, over **either** [transport](#hottransport).

A payload carries a build's module paths and, when a build fails, the source frames webpack puts in the error — so a page that can read the stream can read parts of your source.

The two transports start from different places, because one of them has shipped before and the other has not:

| Transport | Default               | Why                                                                                                                                                                                                                          |
| :-------- | :-------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'sse'`   | `true` — every origin | What the endpoint has always done. Narrowing it would stop a page served from another origin reading its own build, which is a breaking change, so it waits for a major release. **Set `cors` yourself to narrow it today.** |
| `'ws'`    | the local origins     | New in this release, so there is no behavior to keep: `localhost` and anything under it, `127.0.0.1` and `[::1]`, any port, either scheme.                                                                                   |

A page on another port of the same machine is the one cross-origin case that is normal in development, and nothing a remote site can be served from looks like one — which is why the local origins are where both are headed. It is the same set, for the same reason, as Vite's [`server.cors`](https://vite.dev/config/server-options#server-cors) default.

> [!TIP]
>
> To get there now, name them yourself. In the next major release this is what `'sse'` will do on its own:
>
> ```js
> app.use(
>   middleware(compiler, {
>     hot: {
>       cors: /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
>     },
>   }),
> );
> ```

Nothing needs to be set for the normal setup, where the page and the middleware are the same server.

Name your own origins when the page is served from somewhere else — a dev domain in your hosts file, a remote dev box, a container:

```js
app.use(
  middleware(compiler, {
    hot: { cors: ["https://app.test", /^https:\/\/\w+\.dev\.internal$/] },
  }),
);
```

Every accepted form:

| Value                  | Meaning                                                                          |
| :--------------------- | :------------------------------------------------------------------------------- |
| `false`                | Nothing but the endpoint's own origin.                                           |
| `true`                 | Every origin, including remote ones.                                             |
| `'https://app.test'`   | That one origin.                                                                 |
| `['https://app.test']` | Any in the list; entries may be strings or regular expressions.                  |
| `/\.test$/`            | Any origin the pattern matches. Anchor it, or it will match more than you think. |
| `(origin) => boolean`  | Asked about each origin.                                                         |
| `{ origin: … }`        | Any of the above, so a `cors` written for Vite or `expressjs/cors` fits here.    |

`true` is what the middleware did before this option existed, and what [`webpack-hot-middleware`](https://www.npmjs.com/package/webpack-hot-middleware) still does. It lets **any** site loaded in the same browser read your builds, so prefer naming your origins:

```js
app.use(middleware(compiler, { hot: { cors: true } }));
```

**What "may reach it" means differs by transport**, because the two wires enforce it in different places:

|                                | [`'sse'`](#hottransport)                                                                                            | [`'ws'`](#hottransport)                                                                                    |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------- |
| How it is enforced             | The response carries a grant, or does not. Nothing is ever refused; the browser decides what to do with it.         | The upgrade is **refused** with `403` before the handshake completes.                                      |
| An allowed origin              | Echoed back in `Access-Control-Allow-Origin`, with `Vary: Origin` — or `*` for `true`.                              | The handshake proceeds.                                                                                    |
| A request with no origin       | Served. Every same-origin `EventSource` is one: a browser sends no `Origin` for one, and needs no grant to read it. | Allowed. Browsers always send `Origin` on a handshake, so this is a Node client, a health check or a test. |
| The origin it was addressed as | Served, and the browser never consults these headers for a same-origin read anyway.                                 | Allowed whatever `cors` says — it is the page the middleware is serving, not another origin.               |

A handshake is not subject to CORS: a browser sends `Origin` and pays no attention to what comes back, so on that wire the option can only be honoured by refusing. That refusal applies to [`attach(server)`](#attachserver) and [`handleUpgrade(req, socket, head)`](#handleupgradereq-socket-head) alike.

> [!TIP]
>
> If your server already decides for itself who may connect — the way [webpack-dev-server](https://github.com/webpack/webpack-dev-server) does with `allowedHosts` — set `cors: true` so yours is the only rule and the middleware's default does not refuse first. A refusal is logged with the origin and this remedy, so you will see which it was.

A **function** [transport](#hottransport) of your own is handed the option as it was given, as `cors`, and decides for itself what to do with it.

> [!IMPORTANT]
>
> The local-origins set trusts every other server on the developer's own machine, because it cannot tell them apart from your dev server. If one of them serves content someone else controls, set `cors` to the origins you actually use.
>
> This is about who may reach the endpoint, and nothing else. It does not decide who may reach the **assets** the middleware serves, which is your server's to answer — with a `Cross-Origin-Resource-Policy` response header, or with whatever your framework's own CORS middleware does.

#### `hot.token`

Type: `Boolean | String`
Default: `false`

A secret the injected client carries and the endpoint requires. Reaching the stream then takes something a page has to have been **given**, rather than a header a browser may or may not send.

[`cors`](#hotcors) is answered by `Origin`, and that is the weakness: a browser omits `Origin` and the whole `Sec-Fetch-*` family when the destination is not [potentially trustworthy](https://w3c.github.io/webappsec-secure-contexts/#is-origin-trustworthy) — plain `http` to anything but `localhost`, which is what `host: '0.0.0.0'` gives you. webpack-dev-server shipped two fixes built on those headers and both were bypassed exactly that way ([CVE-2026-6402](https://github.com/advisories/GHSA-79cf-xcqc-c78w), then [CVE-2026-14620](https://github.com/advisories/GHSA-f5vj-f2hx-8m93)). A token asks the browser to volunteer nothing.

**Off by default, on both transports**, and `true` in the next major release. A token only reaches the browser on the entry this middleware adds, and `inject` being on does not mean an entry was added — it is skipped when every entry point already pulls the client in, when [`hot.transport`](#hottransport) is a function, and for a non-web target. Requiring one by default would turn each of those into a `403` on every client.

Turn it on, which is all the normal setup needs — the client is injected, so it is handed the token and uses it:

```js
app.use(middleware(compiler, { hot: { token: true } }));
```

If you turn it on where no client was injected, the middleware says so rather than leaving you with an unexplained `403`:

```
[webpack-dev-middleware] 'hot.token' requires a token on the endpoint, but no
client entry was added to hand one over, so every client will be refused.
```

> [!IMPORTANT]
>
> **What a token does not protect.** The client reads it from its entry query, so it is a string in the bundle. Anything that can already read your bundle cross-origin can read the token out of it — and over plain `http` to a non-`localhost` address, nothing stops that unless your server sends `Cross-Origin-Resource-Policy`. The token hardens every case where the bundle is not readable; where it is, your source has already gone and the stream is the smaller loss. Closing that needs the response header and a `Host` allowlist, which are [your server's](#security) to set.

**Wiring the client yourself.** The token travels in the entry this middleware adds, so `hot.inject: false` turns the requirement off — there would be no way to hand one over, and requiring it would refuse a client you wired correctly.

A configuration that already lists the client as an entry is the other half of that: it is built before the middleware exists, so it cannot carry a token minted per run. Give it one of your own instead, which both sides can know in advance:

```js
const token = "a-secret-of-my-own";

// webpack.config.js
entry: [`webpack-dev-middleware/client?token=${token}`, "./src/index.js"];

// and the middleware
app.use(middleware(compiler, { hot: { transport: "ws", token } }));
```

Or read the minted one off the instance, for a client you serve yourself:

```js
const instance = middleware(compiler, {
  hot: { transport: "ws", token: true },
});

app.get("/my-client-config.json", (_req, res) => {
  res.json({ token: instance.token });
});
```

`false` requires none, which is the default.

#### `hot.inject`

Type: `Boolean`
Default: `true`

Add the client entry and `HotModuleReplacementPlugin` to the compilation. Set it to `false` to wire both yourself — see [Hot Module Replacement client](#hot-module-replacement-client).

Turn it off when you have a client of your own that the middleware will not recognize as one (anything other than `webpack-dev-middleware/client`), or when you do not want the hot runtime in your bundle at all and are using the endpoint through [`subscribe`](#custom-events) instead.

#### `hot.statsOptions`

> [!WARNING]
>
> Deprecated, and removed in the next major release. Do not use it.

Use these instead:

| To                                                              | Use                                                                                              |
| :-------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| decide what a build reports, in the terminal and in the payload | [`stats`](#stats)                                                                                |
| quiet the browser console alone                                 | the client's [`logging`](#client-options)                                                        |
| hide problems from the overlay alone                            | the client's [`overlay`](#client-overlay-options)                                                |
| drop a warning everywhere at once                               | webpack's [`ignoreWarnings`](https://webpack.js.org/configuration/other-options/#ignorewarnings) |

Values still passed here apply until the option is removed, except `hash`, `timings` and `children`, which are ignored: the client compares `hash` against its own bundle's to decide whether an update applies, `timings` carries the build time it reports, and `children` would replace the bundle's hash with a child compilation's, so a page would reload instead of updating.

## Hot Module Replacement client

The bundled application needs a small runtime that subscribes to the endpoint and applies the updates. **`hot` puts it there for you**, along with `HotModuleReplacementPlugin` — enabling the option is the whole of what a webpack configuration needs:

```js
const middleware = require("webpack-dev-middleware");

app.use(middleware(compiler, { hot: true }));
// no entry to add, no plugin to apply, no configuration change
```

The runtime is told the endpoint and the transport the middleware resolved, so the two agree without the same value being written in two places.

Set `hot.inject` to `false` to wire it yourself instead — the runtime is published under the `./client` subpath:

```js
const webpack = require("webpack");

module.exports = {
  entry: ["webpack-dev-middleware/client", "./src/app.js"],
  plugins: [new webpack.HotModuleReplacementPlugin()],
};
```

An entry point that already has the client is left alone, so this keeps working without `hot.inject: false`. It is decided per entry point rather than per compilation: in a build with `landing` and `dashboard` where only `landing` has the client, `dashboard` still gets one, because they are separate pages and it would otherwise connect to nothing.

The client is recognized as `webpack-dev-middleware/client` (with or without a query) or as the path that resolves to, so your own `./src/client/index.js` is your own file. It is a best effort over the `entry` shapes it can read: a function is computed per build and cannot be read, and a request can reach the client through an alias or a loader. Missing one costs a duplicate entry, not a broken build, and `hot.inject: false` is the way out.

#### Which compilations get the runtime

Only the ones a browser runs, decided by the compilation's [`target`](https://webpack.js.org/configuration/target/):

| `target`                                                       | Gets the runtime |
| :------------------------------------------------------------- | :--------------- |
| unset (webpack's default), `web`, `browserslist: …`            | yes              |
| `webworker`                                                    | yes              |
| `electron-renderer`, `electron-preload`, `nwjs`, `node-webkit` | yes              |
| universal — `web` and `node` together, as in `["node", "web"]` | yes              |
| `node`, `node14`, `async-node`, `electron-main`                | no               |
| `deno`                                                         | no               |
| `false`, or a version with no platform such as `es2020`        | no               |

So in a multi-compiler build the browser half gets a client and the server-rendering half does not, with nothing to configure.

**Web workers are included.** A worker has no `window` and no document, but it has `EventSource`, `WebSocket` and webpack's runtime, which is all an update needs — so a worker compilation gets a client and applies updates in place, with the overlay and the building indicator left to the page. The one thing a worker cannot do is reload itself, since it has no `location.reload`; when an update cannot be applied the client says so and leaves the page that started the worker to reload it.

`deno` is a context webpack also counts as `web`, and it stays out until it can be tested there — it has no `window` either, and whether the transports are available is not something this project's test suite can answer.

The last row names no platform for the middleware to go on; if it is a browser bundle, add the entry yourself as above.

#### Upgrading a project that wired it up itself

Nothing has to change, and both pieces are recognized rather than duplicated:

- An entry that is already `webpack-dev-middleware/client` (with or without a query) is left as it is.
- `HotModuleReplacementPlugin` already in `plugins` is not applied twice. It is now redundant, and the middleware says so once per build so you can drop it.

Two things do change, and `hot.inject: false` turns both off:

- **A client the middleware does not recognize** — anything other than `webpack-dev-middleware/client`, such as another package's hot client — is not detected, so a second client is added and both connect.
- **A project with no `HotModuleReplacementPlugin` on purpose** now gets one, which puts the HMR runtime in the bundle and changes its output. If you only wanted the endpoint to listen to through [`subscribe`](#custom-events), set `hot.inject: false`.

One caveat: if the compiler was already watching before the middleware was created, the runtime appears from the next build onwards rather than the first one. Create the middleware before starting the watch to avoid it.

No client is added when [`hot.transport`](#hottransport) is a function either — the built-in one speaks Server-Sent Events and WebSocket, and a transport of your own carries whatever protocol you wrote it to carry, so the client that speaks it is yours to add unless [`hot.client.transport`](#client-options) says which of the two yours speaks. `HotModuleReplacementPlugin` is still applied for you. `hot.inject: false` silences the reminder, and turns that off as well — apply the plugin yourself if you use it.

The [client options](#client-options) below are set on the middleware, next to
the rest of the hot configuration, and the injected entry carries them to the
browser:

```js
app.use(
  middleware(compiler, {
    hot: { client: { overlay: false, logging: "warn" } },
  }),
);
```

Every option below can be set either way, and they are the same options: what
`hot.client` takes is what the query carries. `transport`, `path` and `name`
differ only in having a value the middleware already knows — the resolved
[`hot.transport`](#hottransport), the resolved [`hot.path`](#hotpath) and the
compilation's own name — so setting one replaces that default rather than
adding to it. That is what a page reaching the endpoint through a proxy or on
another origin needs:

```js
app.use(
  middleware(compiler, {
    hot: { client: { path: "wss://dev.example.com/__webpack_hmr" } },
  }),
);
```

A [`hot.transport`](#hottransport) of your own gets no client by default, since
the built-in one speaks Server-Sent Events and WebSocket and cannot know what
yours carries. If yours carries one of those two, say which and the client is
added as usual:

```js
app.use(
  middleware(compiler, {
    hot: { transport: myOwnStream, client: { transport: "sse" } },
  }),
);
```

The [`overlay` filters](#client-overlay-options) can be functions here as well.
They travel to the browser as their own source, so write one as an arrow
function or a `function` — a method shorthand (`overlay: { errors(message) {} }`)
works too, but anything that cannot be serialized is refused when the
middleware is created rather than left to fail in the page:

```js
app.use(
  middleware(compiler, {
    hot: {
      client: {
        overlay: {
          warnings: false,
          errors: (error) => !error.message.includes("deprecated"),
        },
      },
    },
  }),
);
```

`hot.client` is read only when the client is injected. With `hot.inject: false`,
or for a client the configuration already has as an entry, the query string on
the entry path is the only source — and it works either way:

```js
entry: [
  "webpack-dev-middleware/client?apply=hmr-only&overlay=false",
  "./src/app.js",
];
```

The runtime ships as ES5 and uses no built-in newer than ES5, apart from
`Promise`, the transport in use (`EventSource` or `WebSocket`) and what HMR
itself needs, so it runs in old
browsers too — set [`target`](https://webpack.js.org/configuration/target/) to
`["web", "es5"]` in your configuration so webpack emits its own runtime as ES5
as well.

### Client options

Each of these is set either on the middleware as `hot.client.<name>` or on the
entry's query as `<name>=<value>`, with the same effect and the same spelling in
both. The last six are the names `apply` and `connect` replaced; they still
work, folded into those two, and go away in the next major release.
`transport`, `path` and `name` default to what the middleware resolved rather
than to the value in the table, which is what they are when nothing else is
serving them.

One of them, `apply`, can also be set per page through a url parameter, which
the rest cannot — see [opting one page out](#opting-one-page-out).

|        Name         |                   Type                   |          Default           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :-----------------: | :--------------------------------------: | :------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     `transport`     |                 `string`                 |          `"sse"`           | How the events are carried: `"sse"` or `"ws"`. Defaults to the server [`hot.transport`](#hottransport); override it only together with `path`, since a client asking this endpoint for a protocol it does not serve never connects — the middleware warns when it sees that.                                                                                                                                                                                                                                                                                            |
|       `path`        |                 `string`                 |      `/__webpack_hmr`      | Where the runtime connects. Defaults to the server [`hot.path`](#hotpath); set it to an absolute url (`wss://dev.example.com/__webpack_hmr`) for an endpoint on another origin or behind a proxy.                                                                                                                                                                                                                                                                                                                                                                       |
|       `apply`       | `"hmr"\|"hmr-only"\|"reload"\|"nothing"` |          `"hmr"`           | What a build does to the page. `"hmr"` applies the update and loads the page again if it cannot be applied; `"hmr-only"` applies it and stops with a message if it cannot; `"reload"` skips HMR and loads the page again on any build that changed something; `"nothing"` leaves the page alone until you reload it. One option rather than three booleans, since only four of their eight combinations differed.                                                                                                                                                       |
|      `connect`      |     `boolean\|{ retries, timeout }`      |           `true`           | Whether to connect when the entry runs, and how the connection is held open. `false` does not connect — call `setOptionsAndConnect()` yourself. `retries` is how many times to reconnect before giving up, and `Infinity` never does; unset, `"sse"` keeps trying for as long as the page is open while `"ws"` gives up after `10`. `timeout` is how long silence is tolerated before reconnecting, in milliseconds, and the interval between reconnections — `"sse"` only, since a `"ws"` heartbeat is a protocol ping the browser answers without telling JavaScript. |
|      `overlay`      |            `boolean\|Object`             |           `true`           | In-page overlay for problems: a boolean, or a JSON object — see [overlay options](#client-overlay-options). Same value shape as webpack-dev-server's [`client.overlay`](https://webpack.js.org/configuration/dev-server/#overlay), plus a few webpack-dev-middleware extensions.                                                                                                                                                                                                                                                                                        |
|     `urlPrefix`     |                 `string`                 | `"webpack-dev-middleware"` | Names the page-url parameter (`<prefix>-apply`) that overrides [`apply`](#client-options) for a single page — see [opting one page out](#opting-one-page-out). Change it if you are building a server of your own and want parameters named after it.                                                                                                                                                                                                                                                                                                                   |
|      `logging`      |                 `string`                 |          `"info"`          | Logger level — one of `"none"`, `"error"`, `"warn"`, `"info"`, `"log"`, `"verbose"`. Uses webpack's runtime logger.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
|       `name`        |                 `string`                 |            `""`            | Restrict updates to a specific compilation name (useful with multi-compiler).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
|     `progress`      |                `boolean`                 |           `true`           | Show a small badge in the page while a rebuild is in progress (with the compilation percentage when the server enables `hot.progress`). Set to `false` to disable.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `dynamicPublicPath` |                `boolean`                 |          `false`           | Prefix `path` with `__webpack_public_path__` at runtime. The leading slash of `path` is stripped and no other normalization is applied, so the public path should end with `/`.                                                                                                                                                                                                                                                                                                                                                                                         |
|        `hot`        |                `boolean`                 |           `true`           | Apply a build through Hot Module Replacement. Set to `false` for a project without `HotModuleReplacementPlugin`, and the page is reloaded instead — see `liveReload`. **Deprecated**, removed in the next major release — use [`apply`](#client-options).                                                                                                                                                                                                                                                                                                               |
|    `liveReload`     |                `boolean`                 |           `true`           | Reload the page on a build that changed something, when `hot` is off. A build that changed nothing is left alone. Set both this and `hot` to `false` and a build reaches the page only when you reload it yourself. **Deprecated**, removed in the next major release — use [`apply`](#client-options).                                                                                                                                                                                                                                                                 |
|      `reload`       |                `boolean`                 |           `true`           | Fall back to a full page reload when an update cannot be applied through HMR (e.g. recovering from a broken build). Enabled by default, unlike webpack-hot-middleware; set to `false` to keep HMR-only. Unrelated to `liveReload`: this one is about an update that was tried. **Deprecated**, removed in the next major release — use [`apply`](#client-options).                                                                                                                                                                                                      |
|    `autoConnect`    |                `boolean`                 |           `true`           | Connect on load; set to `false` and call `setOptionsAndConnect()` manually. **Deprecated**, removed in the next major release — use [`connect`](#client-options).                                                                                                                                                                                                                                                                                                                                                                                                       |
|     `reconnect`     |                 `number`                 |     `Infinity` / `10`      | How many times to reconnect before giving up. Unset, `"sse"` keeps trying for as long as the page is open — a dev server is expected to come back — while `"ws"` gives up after `10`. Setting it applies to both. **Deprecated**, removed in the next major release — use [`connect`](#client-options).                                                                                                                                                                                                                                                                 |
|      `timeout`      |                 `number`                 |          `20000`           | How long silence is tolerated before reconnecting, in milliseconds, and the interval between reconnections. `"sse"` only: its heartbeat arrives as data the client can see, while a `"ws"` heartbeat is a protocol ping the browser answers without telling JavaScript — a half-open socket there is terminated by the server instead. **Deprecated**, removed in the next major release — use [`connect`](#client-options).                                                                                                                                            |

#### A client of your own

The transport the page speaks can be replaced. A client is a class constructed
with the url, the same shape webpack-dev-server's
[`client.webSocketTransport`](https://webpack.js.org/configuration/dev-server/#websockettransport)
has always taken, so one written for that works here unchanged:

```js
// my-client.js
module.exports = class MyClient {
  constructor(url) {
    this.socket = new WebSocket(url);
  }

  onOpen(fn) {
    this.socket.onopen = fn;
  }

  onClose(fn) {
    this.socket.onclose = fn;
  }

  onMessage(fn) {
    // Called with the message as a string.
    this.socket.onmessage = (event) => fn(event.data);
  }

  close() {
    // Close without reporting it, so the runtime does not reconnect.
    this.socket.onclose = null;
    this.socket.close();
  }
};
```

Reconnecting and the backoff between attempts are the runtime's job, not the
client's — it only has to report `onOpen` and `onClose` honestly. Extend one of
the built-in two rather than starting over if you only want to change part of
it:

```js
// The runtime ships as ES modules, so import it — a `require()` through a
// bundler hands back the namespace, whose class is on `.default`.
import EventSourceClient from "webpack-dev-middleware/client/sse";
import WebSocketClient from "webpack-dev-middleware/client/ws";
```

The runtime picks it up from `__webpack_dev_server_client__`, which
webpack-dev-server sets from its `client.webSocketTransport` option; a module
exporting the class as `default` is unwrapped. An injected client wins over
both built-ins, whatever `transport` says.

#### Client `overlay` options

Passed as a JSON object, e.g. `?overlay={"warnings":false}`. The three problem
kinds default to `true` when the object leaves them out; a filter function
(URI-encoded) shows only the messages it accepts.

|           Name           |        Type         |   Default   | Description                                                                                                                                                                                                                                     |
| :----------------------: | :-----------------: | :---------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|         `errors`         | `boolean\|Function` |   `true`    | Show build errors.                                                                                                                                                                                                                              |
|        `warnings`        | `boolean\|Function` |   `true`    | Show build warnings.                                                                                                                                                                                                                            |
|     `runtimeErrors`      | `boolean\|Function` |   `true`    | Show uncaught runtime errors and unhandled rejections.                                                                                                                                                                                          |
| `trustedTypesPolicyName` |      `string`       | `undefined` | Trusted Types policy name used for the overlay's HTML.                                                                                                                                                                                          |
|         `styles`         |      `Object`       | `undefined` | webpack-dev-middleware extension: CSS overrides for the overlay card (`element.style` keys).                                                                                                                                                    |
|       `ansiColors`       |      `Object`       | `undefined` | webpack-dev-middleware extension: ANSI → HTML color map, as in [ansi-html-community](https://github.com/mahdyar/ansi-html-community#set-colors).                                                                                                |
|   `openEditorEndpoint`   |      `string`       |    `""`     | webpack-dev-middleware extension: when set, file references become clickable and issue `GET <endpoint>?fileName=<file:line:column>`; your server provides it, e.g. a route calling [launch-editor](https://github.com/yyx990803/launch-editor). |
|        `paginate`        |      `boolean`      |   `true`    | webpack-dev-middleware extension: show one problem at a time with prev/next navigation.                                                                                                                                                         |

### Programmatic API

`webpack-dev-middleware/client` also exports a few functions for advanced cases:

```js
const hotClient = require("webpack-dev-middleware/client");

// Receive every HMR payload (building / built / sync / custom).
hotClient.subscribeAll((payload) => {
  console.log("hot event", payload);
});

// Receive payloads whose `action` is not recognised by the client (i.e. custom
// payloads published via the server's `instance.context.hot.publish(...)`).
hotClient.subscribe((payload) => {
  // do something
});

// Replace the default error overlay with your own implementation.
hotClient.useCustomOverlay({
  showProblems(type, lines) {
    /* ... */
  },
  clear() {
    /* ... */
  },
});

// Connect manually when `connect=false`. Accepts the same option keys as
// the query-string API above.
hotClient.setOptionsAndConnect({ path: "/__hmr" });

// Close the SSE connection and stop reconnecting (e.g. before tearing the
// page down). A later `setOptionsAndConnect` call opens a fresh connection.
hotClient.disconnect();
```

The error overlay is also exposed as a standalone module so other tooling
(e.g. `webpack-dev-server`) can reuse it without the SSE client:

```js
import configureOverlay, {
  clear,
  showProblems,
} from "webpack-dev-middleware/client/overlay";

const overlay = configureOverlay({
  // ansiColors, overlayStyles, trustedTypesPolicyName, catchRuntimeError,
  // openEditorEndpoint, paginate
});

overlay.showProblems("errors", ["Something broke"]);
overlay.clear();
```

The overlay state is a per-page singleton: every bundled copy of the module
renders into the same overlay. Multiple clients can report side by side by
passing a `source` — each source keeps its own slot and the overlay shows the
union, with errors from any source taking precedence over warnings:

```js
overlay.showProblems("errors", ["Something broke"], "my-client");
// Drop only this client's problems; other sources stay on screen.
overlay.clear("my-client");
// Without a source, everything is dismissed (same as Esc / backdrop / ×).
overlay.clear();
```

The building indicator is exposed the same way:

```js
import { hide, show } from "webpack-dev-middleware/client/indicator";

show("Rebuilding…"); // pulsing dot
show("Rebuilding… 42%", 42); // progress ring
hide();
```

The badge is a per-page singleton shared by every bundled copy of the module.
Concurrent builds can report through a `source` — the badge stays until every
source finished:

```js
show("Rebuilding app…", undefined, "app");
show("Rebuilding admin…", undefined, "admin");
hide("app"); // still shown — "admin" is building
hide("admin"); // removed
hide(); // without a source: removed unconditionally
```

## Migrating from webpack-hot-middleware

The `hot` option replaces [`webpack-hot-middleware`](https://github.com/webpack/webpack-hot-middleware): one middleware serves the assets and the SSE endpoint, and the client runtime ships under `webpack-dev-middleware/client`. The endpoint (`/__webpack_hmr`) and its Server-Sent Events transport are unchanged, so the browser reaches the new server the same way; the payloads, option names and a few defaults need a look.

See [migration-from-webpack-hot-middleware.md](migration-from-webpack-hot-middleware.md) — it walks the whole move: prerequisites, the server and webpack-configuration changes, every option mapped, the behavior differences worth knowing, the other frameworks, troubleshooting, and a checklist.

## HMR notes and troubleshooting

### Browser connection limits (many tabs)

Each open tab keeps one SSE connection to the `hot.path` endpoint. Over
HTTP/1.1, browsers allow only ~6 concurrent connections per origin, so opening
many tabs can leave the extra ones hanging (browsers have marked this
[Won't Fix](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)).
Multiple webpack entries on the same page already share a single connection,
and the endpoint works over HTTP/2 out of the box — serve your development
server over HTTP/2 if you need many simultaneous tabs.

### Filtering warnings

Three layers, from build to presentation:

- webpack's [`ignoreWarnings`](https://webpack.js.org/configuration/other-options/#ignorewarnings) removes them from the stats, so nothing reports them anywhere.
- The middleware's [`stats`](#stats) option decides what a build reports, in the terminal and in the SSE payload alike: `stats: "errors-only"` keeps warnings out of both.
- On the client, `?overlay={"warnings":false}` hides them from the overlay and `?logging=error` from the console, per page rather than per server.

### Paths and public paths

- The client `path` option accepts absolute URLs (the endpoint sends
  `Access-Control-Allow-Origin: *`), which allows connecting across ports or
  hosts. Pages served over HTTPS need the endpoint over HTTPS too.
- For apps with nested routes (`/some/route`), use an absolute
  `output.publicPath` (e.g. `"/"`): with a relative one the browser resolves
  `*.hot-update.json` requests against the current route and they 404.

### Opting one page out

A page can choose its own [`apply`](#client-options) mode with a url parameter,
without changing anything the project is configured with — useful when you are
working _in_ a page that keeps reloading under you:

```
http://localhost:3000/?webpack-dev-middleware-apply=nothing
http://localhost:3000/?webpack-dev-middleware-apply=reload
http://localhost:3000/?webpack-dev-middleware-apply=false
```

`false` is taken as `nothing`, which is what this parameter meant before `apply` replaced the three booleans it covers.

The `webpack-dev-middleware` part is the client's [`urlPrefix`](#client-options), so a server built on this middleware can set `hot.client.urlPrefix` and name the parameter after itself. What follows it is the option, spelled the one way the option is spelled. The name is matched whole and case-insensitively, and a value that is not one of the modes is left alone — a parameter that merely contains the words, or a value such as `nothingness`, changes nothing.

### Reloading the page from the server

Some changes belong to no compilation — a file served straight from disk, for
instance — so nothing tells the page it is stale. Publish a `reload` and it
loads itself again, whatever `apply` is set to:

```js
const instance = middleware(compiler, { hot: true });

watcher.on("change", (file) => {
  instance.context.hot.publish({ action: "reload", file });
});
```

`file` is optional and only names the change in the browser console.

### Custom events

The server can broadcast arbitrary payloads and the client can react to them:

```js
// Server
const instance = middleware(compiler, { hot: true });
instance.context.hot.publish({ action: "say-hello", to: "everyone" });
```

```js
// Client
const hotClient = require("webpack-dev-middleware/client");

hotClient.subscribe((payload) => {
  if (payload.action === "say-hello") {
    console.log(`hello ${payload.to}`);
  }
});
```

## API

`webpack-dev-middleware` also provides convenience methods that can be use to
interact with the middleware at runtime:

### `attach(server)`

Gives the [`hot.transport: "ws"`](#hottransport) endpoint the HTTP server to answer WebSocket upgrades on. A handshake is an upgrade the server answers, which the middleware never sees, so it cannot find the server on its own. Use this when the server is built after the middleware; when it already exists, [`hot.server`](#hotserver) does the same thing.

Does nothing when `hot` is disabled or the transport is Server-Sent Events, which the middleware answers itself.

#### Parameters

##### `server`

Type: `http.Server | https.Server`
Required: `Yes`

The server whose `upgrade` event the endpoint listens on. It stops listening when the middleware is closed.

```js
const http = require("node:http");
const express = require("express");
const webpack = require("webpack");

const middleware = require("webpack-dev-middleware");

const compiler = webpack({/* Webpack configuration */});
const instance = middleware(compiler, { hot: { transport: "ws" } });

// eslint-disable-next-line new-cap
const app = new express();

app.use(instance);

const server = http.createServer(app);

instance.attach(server);
server.listen(3000);
```

### `handleUpgrade(req, socket, head)`

Answers one WebSocket upgrade, for a server that would rather decide each one than hand itself over with [`attach`](#attachserver). Keep your own `upgrade` listener and call this for the requests you accept — a request you do not want never reaches the endpoint, and no handshake happens.

Returns `true` when the endpoint answered the upgrade, and `false` when it was not its request — because the path is another endpoint's, `hot` is disabled, the transport is Server-Sent Events, or the middleware is closed. A `false` is yours to finish: pass the socket to whatever else you serve, or destroy it.

Use this or `attach`, not both: `attach` adds a listener of its own, which would answer the same upgrade a second time.

#### Parameters

##### `req`, `socket`, `head`

The three arguments the server's [`upgrade`](https://nodejs.org/api/http.html#event-upgrade) event gives you, unchanged.

```js
const server = http.createServer(app);

server.on("upgrade", (req, socket, head) => {
  // Your rule, applied before a client can connect.
  if (req.headers.origin !== "http://localhost:3000") {
    socket.destroy();

    return;
  }

  if (!instance.handleUpgrade(req, socket, head)) {
    socket.destroy();
  }
});

server.listen(3000);
```

### `onConnect(fn)`

Calls `fn(client, req)` with each client that joins the hot endpoint, and the request it joined with, before anything is published to it. The same for both transports: `client` is the `ServerResponse` holding the event stream, or the `WebSocket`.

The middleware has no rule about who may listen and applies none — this is what it knows, so a server can apply its own. Close the client from `fn` to turn it away, and it is sent nothing at all, not even the catch-up the next client gets.

What a rule can be built from is worth being clear about. `Host` is which server was asked for and `Origin` is which page is asking, so a rule about browsers usually reads both. Neither identifies the caller: `Origin` is something a browser sends on a page's behalf, and anything that is not a browser can leave it out or send whatever it likes. It is a useful signal for keeping other pages out of a development server, and it is not authentication — if it matters who is connecting, authenticate them.

```js
instance.onConnect((client, req) => {
  // Which server was asked for, and which page is doing the asking. They
  // answer different questions and a rule usually needs both: a page on
  // another origin can reach a server it knows the `Host` of, and a client
  // that is not a browser sends no `Origin` at all.
  if (
    req.headers.host !== "localhost:3000" ||
    req.headers.origin !== "http://localhost:3000"
  ) {
    client.end(); // or `client.close()` over a WebSocket
  }
});
```

Does nothing when `hot` is disabled.

#### Parameters

##### `fn`

Type: `(client: ServerResponse | WebSocket, req: IncomingMessage) => void`
Required: `Yes`

Called once per client, in the order the subscribers were added.

### `publish(payload)`

Put a payload of your own on the hot stream.

The middleware publishes what it knows about — a build starting, finishing, failing. Anything else a server measures is its own, and `ProgressPlugin` is the example: deciding to instrument a build is the server's call, and the middleware is only what carries the result.

The bundled client already renders `{ action: "progress" }` in its building badge, so a server with its own plugin has somewhere to put it:

```js
const compiler = webpack(config);
const instance = middleware(compiler, { hot: true });

// A `ProgressPlugin` callback fires far more often than the whole number
// changes, so the percent is rounded and a tick that repeats one is dropped —
// without that, most of these would be a message on the wire saying what the
// last one said. This is what `hot.progress` did for you.
let lastPercent = -1;

new webpack.ProgressPlugin((percent, message) => {
  const rounded = Math.round(percent * 100);

  if (rounded === lastPercent) {
    return;
  }

  lastPercent = rounded;
  instance.publish({ action: "progress", percent: rounded, message });
}).apply(compiler);

app.use(instance);
```

That replaces [`hot.progress`](#hotprogress), which applied the plugin for you and is deprecated — a server that applies `ProgressPlugin` already would otherwise have two of them on one compiler. The indicator itself is unaffected: whether a `progress` payload is drawn is [`hot.client.progress`](#client-options), which is the browser's end of this and stays.

Rounding and de-duplicating are the two things `hot.progress` did that become yours, which is why the example above does both.

It is not only for progress. Any action the clients understand can be published, and `{ action: "reload" }` is the other useful one — every page loads itself again, whatever `apply` is set to:

```js
chokidar.watch("content/**/*.md").on("change", () => {
  instance.publish({ action: "reload" });
});
```

`{ action: "error", message }` is for something a server decided about one
client rather than about a build — refused for where it connected from, say,
by a policy the server applies and this middleware does not. The runtime logs
the message as given and posts it to the page as `webpackError`. The server
has the only explanation; without somewhere to put it, the connection closes
with the reason nowhere the developer is looking:

```js
instance.onConnect((client, req) => {
  if (!allowed(req.headers.origin)) {
    instance.publishTo(client, {
      action: "error",
      message: `Origin "${req.headers.origin}" is not allowed.`,
    });

    // The two transports hand over different kinds of client: a WebSocket,
    // which closes, and the event stream's `ServerResponse`, which ends.
    // `publishTo` above does not need telling apart; dropping the connection
    // does.
    if (typeof client.close === "function") {
      client.close();
    } else {
      client.end();
    }
  }
});
```

[`publishTo`](#publishtoclient-payload) is how the message reaches that one
client whichever transport is carrying it — writing to the client directly
means knowing which kind it is, and a message written to the wrong one simply
never arrives.

Nothing is sent when no client is connected, so a caller does not have to ask whether anyone is listening — but that is the only traffic it saves, and with a page open every call is a message. Keeping a chatty source down to what changed, as above, is the caller's. Does nothing when `hot` is disabled.

#### Parameters

##### `payload`

Type: `{ action: String, ...}`
Required: `Yes`

An `action` the clients understand, and whatever that action carries. The built-in actions are `building`, `progress`, `built`, `sync`, `reload` and `error`.

### `publishTo(client, payload)`

The same, to one client rather than every one: what a server answering a
single connection needs — refusing it, most of all, which is the only thing
that connection is owed an explanation for.

```js
instance.onConnect((client, req) => {
  if (!allowed(req.headers.origin)) {
    instance.publishTo(client, {
      action: "error",
      message: `Origin "${req.headers.origin}" is not allowed.`,
    });
  }
});
```

The client is one [`onConnect`](#onconnectfn) handed over. Writing to it
directly instead means knowing which transport is carrying it — a WebSocket
client and the event stream's `ServerResponse` are not the same kind of
object, and neither one's write method exists on the other — so a message sent
the wrong way silently never arrives. This takes a client of either and puts
the payload on the wire that client is actually on.

Declines to write to a client that is no longer open, and does nothing when
`hot` is disabled.

#### Parameters

##### `client`

Type: `Object`
Required: `Yes`

A client [`onConnect`](#onconnectfn) was called with.

##### `payload`

Type: `{ action: String, ...}`
Required: `Yes`

As [`publish`](#publishpayload).

### `close(callback)`

Instructs `webpack-dev-middleware` instance to stop watching for file changes.

#### Parameters

##### `callback`

Type: `Function`
Required: `No`

A function executed once the middleware has stopped watching.

```js
const express = require("express");
const webpack = require("webpack");

const compiler = webpack({/* Webpack configuration */});

const middleware = require("webpack-dev-middleware");

const instance = middleware(compiler);

// eslint-disable-next-line new-cap
const app = new express();

app.use(instance);

setTimeout(() => {
  // Says `webpack` to stop watch changes
  instance.close();
}, 1000);
```

### `invalidate(callback)`

Instructs `webpack-dev-middleware` instance to recompile the bundle, e.g. after a change to the configuration.

#### Parameters

##### `callback`

Type: `Function`
Required: `No`

A function executed once the middleware has invalidated.

```js
const express = require("express");
const webpack = require("webpack");

const compiler = webpack({/* Webpack configuration */});

const middleware = require("webpack-dev-middleware");

const instance = middleware(compiler);

// eslint-disable-next-line new-cap
const app = new express();

app.use(instance);

setTimeout(() => {
  // After a short delay the configuration is changed and a banner plugin is added to the config
  new webpack.BannerPlugin("A new banner").apply(compiler);

  // Recompile the bundle with the banner plugin:
  instance.invalidate();
}, 1000);
```

### `waitUntilValid(callback)`

Executes a callback function when the compiler bundle is valid, typically after
compilation.

#### Parameters

##### `callback`

Type: `Function`
Required: `No`

A function executed when the bundle becomes valid.
If the bundle is valid at the time of calling, the callback is executed immediately.

```js
const express = require("express");
const webpack = require("webpack");

const compiler = webpack({/* Webpack configuration */});

const middleware = require("webpack-dev-middleware");

const instance = middleware(compiler);

// eslint-disable-next-line new-cap
const app = new express();

app.use(instance);

instance.waitUntilValid(() => {
  console.log("Package is in a valid state");
});
```

### `getFilenameFromUrl(url)`

Get filename from URL.

#### Parameters

##### `url`

Type: `String`
Required: `Yes`

URL for the requested file.

```js
const express = require("express");
const webpack = require("webpack");

const compiler = webpack({/* Webpack configuration */});

const middleware = require("webpack-dev-middleware");

const instance = middleware(compiler);

// eslint-disable-next-line new-cap
const app = new express();

app.use(instance);

instance.waitUntilValid(() => {
  instance
    .getFilenameFromUrl("/bundle.js")
    .then((filename) => {
      if (!filename) {
        return;
      }

      console.log(`Filename is ${filename}`);
    })
    .catch((err) => {
      console.log(`Error: ${err}`);
    });
});
```

### `plugin(compiler, options)`

Creates middleware instance in plugin mode.

In plugin mode, stats output is written through custom code (i.e. in callback for `watch` or where you are calling `stats.toString(options)`) instead of `console.log`.
In this case, the `stats` option is not supported because `webpack-dev-middleware` does not have access to the code where the stats will be output.
You will also need to manually run the `watch` method.

Why do you need this mode? In some cases, you may want to have multiple dev servers or run only one dev server when you have multiple configurations, and this is suitable for you.

```js
const webpack = require("webpack");
const middleware = require("webpack-dev-middleware");

const compiler = webpack({
  plugins: [
    {
      apply(compiler) {
        const devMiddleware = middleware(
          compiler,
          {/* webpack-dev-middleware options */},
          true,
        );
      },
    },
  ],
  /* Webpack configuration */
});

compiler.watch((err, stats) => {
  if (err) {
    console.error(err);
    return;
  }

  console.log(stats.toString());
});
```

### Plugin wrappers

The following wrappers enable plugin mode for framework integrations:

- `middleware(compiler, options, true)` (connect/express like middleware)
- `middleware.koaWrapper(compiler, options, true)`
- `middleware.hapiWrapper(true)`
- `middleware.honoWrapper(compiler, options, true)`

They are equivalent to `koaWrapper`/`hapiWrapper`/`honoWrapper`, but use plugin mode logging behavior.

### `forwardError`

Type: `boolean`
Default: `false`

Enable or disable forwarding errors to the next middleware. If `true`, errors will be forwarded to the next middleware, otherwise, they will be handled by `webpack-dev-middleware` and a response will be handled case by case.

This option don't work with hono, koa and hapi, because of the differences in error handling between these frameworks and express.

```js
const express = require("express");
const webpack = require("webpack");
const middleware = require("webpack-dev-middleware");

const compiler = webpack({/* Webpack configuration */});

const instance = middleware(compiler, { forwardError: true });

const app = express();
app.use(instance);

app.use((err, req, res, next) => {
  console.log(`Error: ${err}`);
  res.status(500).send("Something broke!");
});
```

## Security

A development server is reachable by anything that can reach the machine it runs on, and a bundle is your source. The middleware is one part of your server, so it only answers for its own part — this is the line, so that nothing is assumed to be covered that is not.

### What the middleware answers for

[`hot.cors`](#hotcors) decides which origins may reach the hot endpoint, over either transport. That is the whole of it.

Mind its defaults, which differ by transport and are not both where they are headed: `'ws'` allows only local origins, while `'sse'` still allows **every** origin, because narrowing it is a breaking change waiting on a major release. **Set `cors` yourself** and a site the developer merely has open cannot read a build's module paths or the source frames webpack puts in a failed build's errors.

### What your server answers for

Anything whose answer depends on how your server is exposed, which the middleware has no way to know.

**Who may load the assets.** A `<script>` tag ignores the same-origin policy, so a site that knows your port and output path can load a bundle and read it back out of webpack's module registry. `Cross-Origin-Resource-Policy` stops that:

```js
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});

app.use(middleware(compiler, { hot: true }));
```

Deliberately not the middleware's default: module federation remotes and micro-frontends load development bundles cross-origin on purpose, and only your server knows whether yours is one of them.

**Which hostnames you answer to.** Nothing here reads the `Host` header, so a name that resolves to your machine reaches your server — which is how DNS rebinding turns a public domain into a request to `localhost`. Match the hostnames you expect, and refuse the rest:

```js
const ALLOWED = new Set(["localhost:8080", "127.0.0.1:8080"]);

app.use((req, res, next) => {
  if (!ALLOWED.has(req.headers.host)) {
    res.status(403).end("Invalid Host header");
    return;
  }

  next();
});
```

**Who may connect, when you have a rule of your own.** If your server already decides this — reading the `Origin` in [`onConnect(fn)`](#onconnectfn), or owning the upgrade with [`handleUpgrade`](#handleupgradereq-socket-head) — set `cors: true` so yours is the only rule and the middleware's default does not refuse first:

```js
const instance = middleware(compiler, {
  hot: { transport: "ws", cors: true },
});

server.on("upgrade", (req, socket, head) => {
  if (!myOwnRuleAllows(req)) {
    socket.destroy();
    return;
  }

  if (!instance.handleUpgrade(req, socket, head)) {
    socket.destroy();
  }
});
```

**Which file an editor is asked to open.** The path the overlay sends to your [`openEditorEndpoint`](#client-overlay-options) comes out of the build's error text, which a loader or a dependency writes — so it is not necessarily a file in your project. An error message carrying `/root/.ssh/id_rsa.pub:1:1` becomes a chip like any other, and clicking it asks your endpoint to open that. Nobody reads the file back, and the reference is shown before it is clicked, but the endpoint is the only place that knows where the project is. Resolve and check before handing anything to an editor:

```js
// `realpath` here too, or every file under a symlinked root is refused —
// which `/tmp` is on macOS.
const root = fs.realpathSync(path.resolve(__dirname));

// Who asked, before which file. Opening an editor is a side effect and nothing
// is read back, so any page the developer happens to be visiting can trigger it
// with a bare `<img src="http://localhost:8080/__open-editor?...">` — no CORS,
// nothing for the browser to refuse on your behalf.
//
// Only the overlay asking this server for a path of its own says `same-origin`.
// An `<img>` from another port on the same host says `same-site`, one from
// another host `cross-site`. So require the single value rather than refusing
// `cross-site`, which is one shape out of several.
const isOverlayAsking = (req) =>
  req.headers["sec-fetch-site"] === "same-origin";

app.get("/__open-editor", (req, res) => {
  // Nothing about this response is worth keeping: it exists for the side
  // effect, carries no body, and which answer is correct depends on who asked.
  // A stored one could be handed to a caller the checks below would refuse.
  res.setHeader("Cache-Control", "no-store");

  if (!isOverlayAsking(req, res)) {
    res.status(403).end("Not an allowed caller");
    return;
  }

  // The trailing position, not the first colon: a Windows path starts with a
  // drive letter and a colon of its own.
  const file = String(req.query.fileName || "").replace(/:\d+:\d+$/, "");

  let resolved;

  try {
    // `realpath`, not just `resolve`: a symlink inside the project can point
    // outside it, and the check below compares the names it is given rather
    // than where they lead. A package can ship one, and `node_modules` is
    // inside the root. It also answers "no such file" for a reference to
    // something that was never there.
    resolved = fs.realpathSync(path.resolve(root, file));
  } catch {
    res.status(404).end("No such file");
    return;
  }

  // `path.relative` rather than `startsWith`: a sibling directory shares the
  // prefix of the root it sits next to.
  const relative = path.relative(root, resolved);

  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    res.status(403).end("Outside the project");
    return;
  }

  launchEditor(resolved);
  res.end();
});
```

Refusing anything that is not `same-origin` is deliberately the strict reading, and it has two consequences worth knowing before you copy it.

**An endpoint on another origin needs the other check.** Point `openEditorEndpoint` at another port or host and the overlay's own request becomes `same-site` or `cross-site`, so the guard above would refuse it. Check the `Origin` there instead — and require it to be present, which is what makes that check equivalent rather than weaker: a cross-origin `fetch` always sends it, while an `<img>` or a `<form>` cannot send one at all.

That is the one definition to swap. The route, and every path check in it, stays exactly as above:

```js
const OVERLAY_ORIGINS = new Set(["http://localhost:8080"]);

const isOverlayAsking = (req, res) => {
  // Before the check rather than after it: the refusal depends on the origin
  // too, so neither answer may be reused across origins. The middleware's own
  // hot endpoint does the same — see `applyCors` in `src/utils.js`.
  res.setHeader("Vary", "Origin");

  if (!OVERLAY_ORIGINS.has(req.headers.origin)) {
    return false;
  }

  // Allowing the caller is only half of it: the overlay reads the response of
  // a cross-origin `fetch`, and without this the browser discards it. The file
  // still opens — the request reached you — but the overlay says it could not,
  // which is worse than either outcome on its own. Echoing the origin back is
  // safe here because the allowlist already refused everything else, including
  // a request carrying no `Origin` at all.
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin);

  return true;
};
```

**Over plain `http` to anything but `localhost`, neither check can work.** Browsers send `Sec-Fetch-*` only to a potentially trustworthy destination, so a dev server on `http://192.168.1.5:8080` — what `host: "0.0.0.0"` gives you, opened from a phone — gets no Fetch Metadata and no `Origin` on either the overlay's request or an attack. Measured in Chromium, not inferred: both arrive bare and indistinguishable. The guard above then refuses everything, which is the safe direction to fail but does mean the chips stop opening files. Reach the dev server over `localhost` or `https` to have it work, and note that binding the route to loopback does not help by itself — the browser running the attacker's page is on the developer's machine, so `localhost` is reachable from it.

### Or let the server that has all of this do it

[webpack-dev-server](https://github.com/webpack/webpack-dev-server) is this middleware with every one of the above already wired up — `allowedHosts`, the cross-origin checks, the response headers — so none of it is yours to write.

## FAQ

### Avoid blocking requests to non-webpack resources.

Since `output.publicPath` and `output.filename`/`output.chunkFilename` can be dynamic, it's not possible to know which files are webpack bundles (and they public paths) and which are not, so we can't avoid blocking requests.

But there is a solution to avoid it - mount the middleware to a non-root route, for example:

```js
const express = require("express");
const webpack = require("webpack");
const middleware = require("webpack-dev-middleware");

const compiler = webpack({
  // webpack options
});

const app = express();

// Mounting the middleware to the non-root route allows avoids this.
// Note - check your public path, if you want to handle `/dist/`, you need to setup `output.publicPath` to `/` value.
app.use(
  "/dist/",
  middleware(compiler, {
    // webpack-dev-middleware options
  }),
);

app.listen(3000, () => console.log("Example app listening on port 3000!"));
```

## Server-Side Rendering

_Note: this feature is experimental and may be removed or changed completely in the future._

In order to develop an app using server-side rendering, we need access to the
[`stats`](https://github.com/webpack/docs/wiki/node.js-api#stats), which is
generated with each build.

With server-side rendering enabled, `webpack-dev-middleware` sets the `stats` to `res.locals.webpack.devMiddleware.stats`
and the filesystem to `res.locals.webpack.devMiddleware.outputFileSystem` before invoking the next middleware,
allowing a developer to render the page body and manage the response to clients.

_Note: Requests for bundle files will still be handled by
`webpack-dev-middleware` and all requests will be pending until the build
process is finished with server-side rendering enabled._

Example Implementation:

```js
const express = require("express");
const isObject = require("is-object");
const webpack = require("webpack");
const middleware = require("webpack-dev-middleware");

const compiler = webpack({/* Webpack configuration */});

// eslint-disable-next-line new-cap
const app = new express();

// This function makes server rendering of asset references consistent with different webpack chunk/entry configurations
function normalizeAssets(assets) {
  if (isObject(assets)) {
    return Object.values(assets);
  }

  return Array.isArray(assets) ? assets : [assets];
}

app.use(middleware(compiler, { serverSideRender: true }));

// The following middleware would not be invoked until the latest build is finished.
app.use((req, res) => {
  const { devMiddleware } = res.locals.webpack;
  const { outputFileSystem } = devMiddleware;
  const jsonWebpackStats = devMiddleware.stats.toJson();
  const { assetsByChunkName, outputPath } = jsonWebpackStats;

  // Then use `assetsByChunkName` for server-side rendering
  // For example, if you have only one main chunk:
  res.send(`
<html>
  <head>
    <title>My App</title>
    <style>
    ${normalizeAssets(assetsByChunkName.main)
      .filter((path) => path.endsWith(".css"))
      .map((path) => outputFileSystem.readFileSync(path.join(outputPath, path)))
      .join("\n")}
    </style>
  </head>
  <body>
    <div id="root"></div>
    ${normalizeAssets(assetsByChunkName.main)
      .filter((path) => path.endsWith(".js"))
      .map((path) => `<script src="${path}"></script>`)
      .join("\n")}
  </body>
</html>
  `);
});
```

## Support

We do our best to keep Issues in the repository focused on bugs, features, and
needed modifications to the code for the module. Because of that, we ask users
with general support, "how-to", or "why isn't this working" questions to try one
of the other support channels that are available.

Your first-stop-shop for support for webpack-dev-server should by the excellent
[documentation][docs-url] for the module. If you see an opportunity for improvement
of those docs, please head over to the [webpack.js.org repo][wjo-url] and open a
pull request.

From there, we encourage users to visit the [webpack discussions][chat-url] and
talk to the fine folks there. If your quest for answers comes up dry in chat,
head over to [StackOverflow][stack-url] and do a quick search or open a new
question. Remember; It's always much easier to answer questions that include your
`webpack.config.js` and relevant files!

If you're twitter-savvy you can tweet [#webpack][hash-url] with your question
and someone should be able to reach out and lend a hand.

If you have discovered a :bug:, have a feature suggestion, or would like to see
a modification, please feel free to create an issue on Github. _Note: The issue
template isn't optional, so please be sure not to remove it, and please fill it
out completely._

## Other servers

Examples of use with other servers will follow here.

### Connect

```js
const http = require("node:http");
const connect = require("connect");
const webpack = require("webpack");
const devMiddleware = require("webpack-dev-middleware");
const webpackConfig = require("./webpack.config.js");

const compiler = webpack(webpackConfig);
const devMiddlewareOptions = {/** Your webpack-dev-middleware-options */};
const app = connect();

app.use(devMiddleware(compiler, devMiddlewareOptions));

http.createServer(app).listen(3000);
```

### Router

```js
const http = require("node:http");
const finalhandler = require("finalhandler");
const Router = require("router");
const webpack = require("webpack");
const devMiddleware = require("webpack-dev-middleware");
const webpackConfig = require("./webpack.config.js");

const compiler = webpack(webpackConfig);
const devMiddlewareOptions = {/** Your webpack-dev-middleware-options */};

// eslint-disable-next-line new-cap
const router = Router();

router.use(devMiddleware(compiler, devMiddlewareOptions));

const server = http.createServer((req, res) => {
  router(req, res, finalhandler(req, res));
});

server.listen(3000);
```

### Express

```js
const express = require("express");
const webpack = require("webpack");
const devMiddleware = require("webpack-dev-middleware");
const webpackConfig = require("./webpack.config.js");

const compiler = webpack(webpackConfig);
const devMiddlewareOptions = {/** Your webpack-dev-middleware-options */};
const app = express();

app.use(devMiddleware(compiler, devMiddlewareOptions));

app.listen(3000, () => console.log("Example app listening on port 3000!"));
```

### Koa

```js
const Koa = require("koa");
const webpack = require("webpack");
const middleware = require("webpack-dev-middleware");
const webpackConfig = require("./webpack.simple.config");

const compiler = webpack(webpackConfig);
const devMiddlewareOptions = {/** Your webpack-dev-middleware-options */};
const app = new Koa();

app.use(middleware.koaWrapper(compiler, devMiddlewareOptions));
// Alternative usage (when you want to use as a plugin, i.e. all stats will be printed by other code):
// app.use(middleware.koaWrapper(compiler, devMiddlewareOptions, true));

app.listen(3000);
```

### Hapi

```js
const Hapi = require("@hapi/hapi");
const webpack = require("webpack");
const devMiddleware = require("webpack-dev-middleware");
const webpackConfig = require("./webpack.config.js");

const compiler = webpack(webpackConfig);
const devMiddlewareOptions = {};

const server = Hapi.server({ port: 3000, host: "localhost" });

await server.register({
  plugin: devMiddleware.hapiWrapper(),
  options: {
    // The `compiler` option is required
    compiler,
    ...devMiddlewareOptions,
  },
});

// Alternative usage (when you want to use as a plugin, i.e. all stats will be printed by other code):
// await server.register({
//   plugin: devMiddleware.hapiWrapper(true),
//   options: {
//     // The `compiler` option is required
//     compiler,
//     ...devMiddlewareOptions,
//   },
// });

await server.start();

console.log("Server running on %s", server.info.uri);

process.on("unhandledRejection", (err) => {
  console.log(err);
  process.exit(1);
});
```

### Fastify

Fastify interop will require the use of `fastify-express` instead of `middie` for providing middleware support. As the authors of `fastify-express` recommend, this should only be used as a stopgap while full Fastify support is worked on.

```js
const fastify = require("fastify")();
const webpack = require("webpack");
const devMiddleware = require("webpack-dev-middleware");
const webpackConfig = require("./webpack.config.js");

const compiler = webpack(webpackConfig);
const devMiddlewareOptions = {/** Your webpack-dev-middleware-options */};

await fastify.register(require("@fastify/express"));
await fastify.use(devMiddleware(compiler, devMiddlewareOptions));
await fastify.listen(3000);
```

### Hono

```js
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import webpack from "webpack";
import devMiddleware from "webpack-dev-middleware";
import webpackConfig from "./webpack.config.js";

const compiler = webpack(webpackConfig);
const devMiddlewareOptions = {/** Your webpack-dev-middleware-options */};

const app = new Hono();

app.use(devMiddleware.honoWrapper(compiler, devMiddlewareOptions));

// Alternative usage (when you want to use as a plugin, i.e. all stats will be printed by other code):
// const honoDevMiddleware = devMiddleware.honoWrapper(compiler, devMiddlewareOptions, true)

serve(app);
```

## Contributing

Please take a moment to read our contributing guidelines if you haven't yet done so.

[CONTRIBUTING](https://github.com/webpack/sass-loader?tab=contributing-ov-file#contributing)

## License

[MIT](./LICENSE)

[npm]: https://img.shields.io/npm/v/webpack-dev-middleware.svg
[npm-url]: https://npmjs.com/package/webpack-dev-middleware
[node]: https://img.shields.io/node/v/webpack-dev-middleware.svg
[node-url]: https://nodejs.org
[tests]: https://github.com/webpack/webpack-dev-middleware/workflows/webpack-dev-middleware/badge.svg
[tests-url]: https://github.com/webpack/webpack-dev-middleware/actions
[cover]: https://codecov.io/gh/webpack/webpack-dev-middleware/branch/main/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack/webpack-dev-middleware
[discussion]: https://img.shields.io/github/discussions/webpack/webpack
[discussion-url]: https://github.com/webpack/webpack/discussions
[size]: https://packagephobia.com/badge?p=webpack-dev-middleware
[size-url]: https://packagephobia.com/result?p=webpack-dev-middleware
[docs-url]: https://webpack.js.org/guides/development/#using-webpack-dev-middleware
[hash-url]: https://twitter.com/search?q=webpack
[middleware-url]: https://github.com/webpack/webpack-dev-middleware
[stack-url]: https://stackoverflow.com/questions/tagged/webpack-dev-middleware
[chat-url]: https://github.com/webpack/webpack/discussions
[wjo-url]: https://github.com/webpack/webpack.js.org
