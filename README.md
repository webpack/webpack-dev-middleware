<div align="center">
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200" src="https://webpack.js.org/assets/icon-square-big.svg">
  </a>
</div>

[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]
[![tests][tests]][tests-url]
[![coverage][cover]][cover-url]
[![chat][chat]][chat-url]
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

_Note: We do not recommend installing this module globally._

## Usage

```js
const webpack = require('webpack');
const middleware = require('webpack-dev-middleware');
const compiler = webpack({
  // webpack options
});
const express = require('express');
const app = express();

app.use(
  middleware(compiler, {
    // webpack-dev-middleware options
  })
);

app.listen(3000, () => console.log('Example app listening on port 3000!'));
```

## Options

The middleware accepts an `options` Object. The following is a property reference for the Object.

### methods

Type: `Array`  
Default: `[ 'GET', 'HEAD' ]`

This property allows a user to pass the list of HTTP request methods accepted by the server.

### headers

Type: `Object`  
Default: `undefined`

This property allows a user to pass custom HTTP headers on each request.
eg. `{ "X-Custom-Header": "yes" }`

### index

Type: `Boolean|String`  
Default: `index.html`

If `false` (but not `undefined`), the server will not respond to requests to the root URL.

### mimeTypes

Type: `Object`  
Default: `undefined`

This property allows a user to register custom mime types or extension mappings.
eg. `mimeTypes: { phtml: 'text/html' }`.

Please see the documentation for [`mime-types`](https://github.com/jshttp/mime-types) for more information.

### publicPath

Type: `String`
Default: `output.publicPath`

The public path that the middleware is bound to.
_Best Practice: use the same `publicPath` defined in your webpack config.
For more information about `publicPath`, please see [the webpack documentation](https://webpack.js.org/guides/public-path)._

### serverSideRender

Type: `Boolean`  
Default: `undefined`

Instructs the module to enable or disable the server-side rendering mode. Please
see [Server-Side Rendering](#server-side-rendering) for more information.

### writeToDisk

Type: `Boolean|Function`  
Default: `false`

If `true`, the option will instruct the module to write files to the configured
location on disk as specified in your `webpack` config file. _Setting
`writeToDisk: true` won't change the behavior of the `webpack-dev-middleware`,
and bundle files accessed through the browser will still be served from memory._
This option provides the same capabilities as the
[`WriteFilePlugin`](https://github.com/gajus/write-file-webpack-plugin/pulls).

This option also accepts a `Function` value, which can be used to filter which
files are written to disk. The function follows the same premise as
[`Array#filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter)
in which a return value of `false` _will not_ write the file, and a return value
of `true` _will_ write the file to disk. eg.

```js
const webpack = require('webpack');
const configuration = {
  /* Webpack configuration */
};
const compiler = webpack(configuration);

middleware(compiler, {
  writeToDisk: (filePath) => {
    return /superman\.css$/.test(filePath);
  },
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
const webpack = require('webpack');
const path = require('path');
const myOutputFileSystem = require('my-fs');
const mkdirp = require('mkdirp');

myOutputFileSystem.join = path.join.bind(path); // no need to bind
myOutputFileSystem.mkdirp = mkdirp.bind(mkdirp); // no need to bind

const compiler = webpack({
  /* Webpack configuration */
});

middleware(compiler, { outputFileSystem: myOutputFileSystem });
```

## API

`webpack-dev-middleware` also provides convenience methods that can be use to
interact with the middleware at runtime:

### `close(callback)`

Instructs a webpack-dev-middleware instance to stop watching for file changes.

### Parameters

#### callback

Type: `Function`

A function executed once the middleware has stopped watching.

### `invalidate()`

Instructs a webpack-dev-middleware instance to recompile the bundle.
e.g. after a change to the configuration.

```js
const webpack = require('webpack');
const compiler = webpack({ ... });
const middleware = require('webpack-dev-middleware');
const instance = middleware(compiler);

app.use(instance);

setTimeout(() => {
  // After a short delay the configuration is changed and a banner plugin is added
  // to the config
  compiler.apply(new webpack.BannerPlugin('A new banner'));

  // Recompile the bundle with the banner plugin:
  instance.invalidate();
}, 1000);
```

### `waitUntilValid(callback)`

Executes a callback function when the compiler bundle is valid, typically after
compilation.

### Parameters

#### callback

Type: `Function`

A function executed when the bundle becomes valid. If the bundle is
valid at the time of calling, the callback is executed immediately.

```js
const webpack = require('webpack');
const compiler = webpack({ ... });
const middleware = require('webpack-dev-middleware');
const instance = middleware(compiler);

app.use(instance);

instance.waitUntilValid(() => {
  console.log('Package is in a valid state');
});
```

## Known Issues

### Multiple Successive Builds

Watching will frequently cause multiple compilations
as the bundle changes during compilation. This is due in part to cross-platform
differences in file watchers, so that webpack doesn't loose file changes when
watched files change rapidly. If you run into this situation, please make use of
the [`TimeFixPlugin`](https://github.com/egoist/time-fix-plugin).

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
const webpack = require('webpack');
const compiler = webpack({
  // webpack options
});
const isObject = require('is-object');
const middleware = require('webpack-dev-middleware');

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
  const outputFileSystem = devMiddleware.outputFileSystem;
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
      .filter((path) => path.endsWith('.css'))
      .map((path) => outputFileSystem.readFileSync(path.join(outputPath, path)))
      .join('\n')}
    </style>
  </head>
  <body>
    <div id="root"></div>
    ${normalizeAssets(assetsByChunkName.main)
      .filter((path) => path.endsWith('.js'))
      .map((path) => `<script src="${path}"></script>`)
      .join('\n')}
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

From there, we encourage users to visit the [webpack Gitter chat][chat-url] and
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

## Contributing

Please take a moment to read our contributing guidelines if you haven't yet done so.

[CONTRIBUTING](./.github/CONTRIBUTING.md)

## License

[MIT](./LICENSE)

[npm]: https://img.shields.io/npm/v/webpack-dev-middleware.svg
[npm-url]: https://npmjs.com/package/webpack-dev-middleware
[node]: https://img.shields.io/node/v/webpack-dev-middleware.svg
[node-url]: https://nodejs.org
[deps]: https://david-dm.org/webpack/webpack-dev-middleware.svg
[deps-url]: https://david-dm.org/webpack/webpack-dev-middleware
[tests]: https://github.com/webpack/webpack-dev-middleware/workflows/webpack-dev-middleware/badge.svg
[tests-url]: https://github.com/webpack/webpack-dev-middleware/actions
[cover]: https://codecov.io/gh/webpack/webpack-dev-middleware/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack/webpack-dev-middleware
[chat]: https://badges.gitter.im/webpack/webpack.svg
[chat-url]: https://gitter.im/webpack/webpack
[size]: https://packagephobia.now.sh/badge?p=webpack-dev-middleware
[size-url]: https://packagephobia.now.sh/result?p=webpack-dev-middleware
[docs-url]: https://webpack.js.org/guides/development/#using-webpack-dev-middleware
[hash-url]: https://twitter.com/search?q=webpack
[middleware-url]: https://github.com/webpack/webpack-dev-middleware
[stack-url]: https://stackoverflow.com/questions/tagged/webpack-dev-middleware
[wjo-url]: https://github.com/webpack/webpack.js.org
