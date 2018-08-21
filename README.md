[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]
[![test][test]][test-url]
[![coverage][cover]][cover-url]
[![chat][chat]][chat-url]

<div align="center">
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200" src="https://webpack.js.org/assets/icon-square-big.svg">
  </a>
  <h1>webpack Dev Middleware</h1>
  <p>
    An express-style development middleware for <a href="https://webpack.js.org">webpack</a>
  </p>
</div>

<h2 align="center">Install</h2>

```bash
npm i -D webpack-dev-middleware
```

> ⚠️ This module should be used for **development only**. We also do not recommend installing this module globally

<h2 align="center">Usage</h2>

```js
const express = require('express')

const webpack = require('webpack')
const middleware = require('webpack-dev-middleware')

const server = express()
const compiler = webpack({ /* webpack config */ })

server.use(middleware(compiler, {
  // webpack-dev-middleware options
}))

server.listen(3000, () => console.log('Server listening on port 3000'))
```

### `API`

`webpack-dev-middleware` provides convenience methods that can be use to interact with the middleware at runtime

|Name|Type|Default|Description|
|:--:|:--:|:-----:|:----------|
|[**`close`**](#close)|`{Function}`|`undefined`|Instructs a webpack-dev-middleware instance to stop watching for file changes. Accepts a callback which is executed once the middleware has stopped watching|
|[**`invalidate`**](#invalidate)|`{Function}`|`undefined`||
|[**`waitUntilValid`**](#waituntilvalid)|`{Function}`|`undefined`|Executes a callback function when the compiler bundle is valid, typically after compilation|

### `close(cb)`

Instructs a `webpack-dev-middleware` instance to stop watching for file changes

```js
middleware.close(() => ...)
```

### `invalidate()`

Instructs a `webpack-dev-middleware` instance to recompile the bundle e.g after a change to the configuration

```js
const webpack = require('webpack')
const middleware = require('webpack-dev-middleware')

const compiler = webpack({ ... })
const instance = middleware(compiler)

app.use(instance)

setTimeout(() => {
  // After a short delay the configuration is changed
  // and a banner plugin is added to the config
  compiler.apply(new webpack.BannerPlugin('A new banner'))

  // Recompile the bundle with the banner plugin:
  instance.invalidate()
}, 1000)
```

### `waitUntilValid(cb)`

Executes a callback `{Function}` when the compiler bundle is valid, typically after compilation. A function executed when the bundle becomes valid. If the bundle is valid at the time of calling, the callback is executed immediately

```js
const webpack = require('webpack')
const middleware = require('webpack-dev-middleware')

const compiler = webpack({ ... })
const instance = middleware(compiler)

app.use(instance)

instance.waitUntilValid(() => {
  console.log('Package is in a valid state')
})
```

<h2 align="center">Options</h2>

|Name|Type|Default|Description|
|:--:|:--:|:-----:|:----------|
|[**`lazy`**](#lazy)|`{Boolean}`|`undefined`|...|
|[**`stats`**](#stats)|`{Object}`|`{ context: process.cwd() }`|...|
|[**`index`**](#index)|`{String}`|`undefined`|The index path for the web server, defaults to `index.html`|
|[**`logger`**](#logger)|`{Object}`|[`webpack-log`](https://github.com/webpack-contrib/webpack-log)|...|
|[**`logTime`**](#logtime)|`{Boolean}`|`false`|If `true` the log output of the module will be prefixed by a timestamp in `HH:mm:ss` format|
|[**`logLevel`**](#loglevel)|`{String}`|`'info'`|...|
|[**`reporter`**](#reporter)|`{Object}`|`undefined`|...|
|[**`headers`**](#headers)|`{Object}`|`undefined`|This option allows a user to pass custom HTTP headers for each request|
|[**`mimeTypes`**](#mimeTypes)|`{Object}`|`null`|This option allows a user to register custom mime types or extension mappings|
|[**`publicPath`**](#publicpath)|`{String}`|`undefined`|...|
|[**`writeToDisk`**](#writetodisk)|`{Boolean\|Function}`|`false`|If `true`, the option will instruct the module to write files to the configured location on disk as specified in your `webpack` config file|
|[**`watchOptions`**](#watchoptions)|`{Object}`|`{ aggregateTimeout: 200 }`|...|
|[**`serverSideRender`**](#serversiderender)|`{Boolean}`|`false`|...|

### `lazy`  

This option instructs the module to operate in 'lazy' mode, meaning that it won't recompile when files change, but rather on each request

```js
const options = {
  lazy: true
}

server.use(middleware(compiler, options))
```

### `stats`   

Options for formatting statistics displayed during and after compile. For more
information and property details, please see the
[webpack documentation](https://webpack.js.org/configuration/stats/#stats)

```js
const options = {
  stats: {...}
}

server.use(middleware(compiler, options))
```

### `index`   

If falsy (but not `undefined`), the server will not respond to requests to the root URL.

```js
const options = {
  index: 'main.html'
}

server.use(middleware(compiler, options))
```

### `logger`         

In the rare event that a user would like to provide a custom logging interface, this property allows the user to assign one. The module leverages [`webpack-log`](https://github.com/webpack-contrib/webpack-log#readme) for creating the [`loglevelnext`](https://github.com/shellscape/loglevelnext#readme) logging management by default. Any custom logger must adhere to the same exports for compatibility. Specifically, all custom loggers must have the

- `log.trace`
- `log.debug`
- `log.info`
- `log.warn`
- `log.error`

Please see the documentation for `loglevel` for more information

### `logTime`

If `true` the log output of the module will be prefixed by a timestamp in
`HH:mm:ss` format

```js
const options = {
  logTime: true
}

server.use(middleware(compiler, options))
```

### `logLevel`

This property defines the level of messages that the module will log. Valid levels include

- `trace`
- `debug`
- `info`
- `warn`
- `error`
- `silent`

Setting a log level means that all other levels below it will be visible in the console. Setting `logLevel: 'silent'` will hide all console output. The module leverages [`webpack-log`](https://github.com/webpack-contrib/webpack-log#readme) for logging management, and more information can be found on its page

```js
const options = {
  logLevel: 'error'
}

server.use(middleware(compiler, options))
```

### `reporter`

Allows users to provide a custom reporter to handle logging within the module.
Please see the [default reporter](/lib/reporter.js)
for an example

```js
const options = {
  reporter: require('my-custom-reporter')
}

server.use(middleware(compiler, options))
```

### `headers`

```js
const options = {
  headers: { 'X-Custom-Header': 'yes' }
}

server.use(middleware(compiler, options))
```

### `mimeTypes`

This option allows a user to register custom mime types or extension mappings e.g `{ 'text/html': [ 'phtml' ] }`. Please see the documentation for [`node-mime`](https://github.com/broofa/node-mime#mimedefine) for more information

### `publicPath`

The public path that the middleware is bound to

> ℹ️ It's best Practice to use the same `publicPath` defined in your webpack config. For more information about `publicPath`, please see [the webpack documentation](https://webpack.js.org/guides/public-path)

```js
const options = {
  publicPath: '/'
}

server.use(middleware(compiler, options))
```

> ⚠️ The `publicPath` option is **required**, whereas all other options are optional

### `writeToDisk`

If `true`, the option will instruct the module to write files to the configured
location on disk as specified in your `webpack` config file

> ⚠️ Setting `{ writeToDisk: true }` won't change the behavior of the `webpack-dev-middleware`, and bundle files accessed through the browser will still be served from memory

> ℹ️ This option provides the same capabilities as the [`WriteFilePlugin`](https://github.com/gajus/write-file-webpack-plugin/pulls)

```js
const options = {
  writeToDisk: true
}

server.use(middleware(compiler, options))
```

This option also accepts a `{Function}` value, which can be used to filter which files are written to disk. The function follows the same premise as [`Array#filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter) in which a return value of `false` _will not_ write the file, and a return value of `true` _will_ write the file to disk e.g

```js
const options = {
  writeToDisk (file) {
    return /superman\.css$/.test(file)
  }
}

server.use(middleware(compiler, options))
```

### `watchOptions`  

The module accepts an `{Object}` containing options for file watching, which is passed directly to the compiler provided. For more information on watch options please see the [webpack documentation](https://webpack.js.org/configuration/watch/#watchoptions)

```js
const options = {
  watchOptions: {...}
}

server.use(middleware(compiler, options))
```

### `serverSideRender`

Instructs the module to enable or disable the server-side rendering mode. Please
see [Server-Side Rendering](#server-side-rendering) for more information

```js
const options = {
  serverSideRender: true
}

server.use(middleware(compiler, options))
```

<h2 align="center">Examples</h2>

### `Server-Side Rendering`  

> ⚠️ This feature is experimental and may be removed or changed completely in the future

In order to develop an app using server-side rendering, we need access to the
[`stats`](https://github.com/webpack/docs/wiki/node.js-api#stats), which is
generated with each build

With server-side rendering enabled, `webpack-dev-middleware` sets the `stats` to
`res.locals.webpackStats` before invoking the next middleware, allowing a
developer to render the page body and manage the response to clients

> ℹ️ Requests for bundle files will still be handled by `webpack-dev-middleware` and all requests will be pending until the build process is finished with server-side rendering enabled

```js
const isObject = require('is-object')

const webpack = require('webpack')
const middleware = require('webpack-dev-middleware')

const compiler = webpack({ /* webpack config */ })

// This function makes server rendering of asset references
// consistent with different webpack chunk/entry configurations
function normalizeAssets(assets) {
  if (isObject(assets)) {
    return Object.values(assets)
  }

  return Array.isArray(assets) ? assets : [assets]
}

app.use(middleware(compiler, { serverSideRender: true }))

// The following middleware would not be invoked until the latest build is finished
app.use((req, res) => {
  const stats = res.locals.webpackStats.toJson()

  const { assetsByChunkName } = stats

  // then use `assetsByChunkName` for server-sider rendering
  // For example, if you have only one main chunk:
  res.send(`
<html>
  <head>
    <title>My App</title>
    ${normalizeAssets(assetsByChunkName.main)
      .filter((path) => path.endsWith('.css'))
      .map((path) => `<link rel="stylesheet" href="${path}" />`)
      .join('\n')}
  </head>
  <body>
    <div id="root"></div>
    ${normalizeAssets(assetsByChunkName.main)
      .filter((path) => path.endsWith('.js'))
      .map((path) => `<script src="${path}"></script>`)
      .join('\n')}
  </body>
</html>
  `)
})
```


[npm]: https://img.shields.io/npm/v/webpack-dev-middleware.svg
[npm-url]: https://npmjs.com/package/webpack-dev-middleware

[node]: https://img.shields.io/node/v/webpack-dev-middleware.svg
[node-url]: https://nodejs.org

[deps]: https://david-dm.org/webpack/webpack-dev-middleware.svg
[deps-url]: https://david-dm.org/webpack/webpack-dev-middleware

[test]: http://img.shields.io/travis/webpack/webpack-dev-middleware.svg
[test-url]: https://travis-ci.org/webpack/webpack-dev-middleware

[cover]: https://codecov.io/gh/webpack/webpack-dev-middleware/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack/webpack-dev-middleware

[chat]: https://badges.gitter.im/webpack/webpack.svg
[chat-url]: https://gitter.im/webpack/webpack

[docs-url]: https://webpack.js.org/guides/development/#using-webpack-dev-middleware
[middleware-url]: https://github.com/webpack/webpack-dev-middleware
