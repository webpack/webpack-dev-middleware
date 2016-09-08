# webpack-dev-middleware

**THIS MIDDLEWARE SHOULD ONLY USED FOR DEVELOPMENT!**

**DO NOT USE IT IN PRODUCTION!**

## What is it?

It's a simple wrapper middleware for webpack. It serves the files emitted from webpack over a connect server.

It has a few advantages over bundling it as files:

* No files are written to disk, it handle the files in memory
* If files changed in watch mode, the middleware no longer serves the old bundle, but delays requests until the compiling has finished. You don't have to wait before refreshing the page after a file modification.
* I may add some specific optimization in future releases.

## Installation

```
npm install webpack-dev-middleware --save-dev
```

## Usage

``` javascript
var webpackMiddleware = require("webpack-dev-middleware");
app.use(webpackMiddleware(...));
```

Example usage:

``` javascript
app.use(webpackMiddleware(webpack({
	// webpack options
	// webpackMiddleware takes a Compiler object as first parameter
	// which is returned by webpack(...) without callback.
	entry: "...",
	output: {
		path: "/"
		// no real path is required, just pass "/"
		// but it will work with other paths too.
	}
}), {
	// publicPath is required, whereas all other options are optional

	noInfo: false,
	// display no info to console (only warnings and errors)

	quiet: false,
	// display nothing to the console

	lazy: true,
	// switch into lazy mode
	// that means no watching, but recompilation on every request

	watchOptions: {
		aggregateTimeout: 300,
		poll: true
	},
	// watch options (only lazy: false)

	publicPath: "/assets/",
	// public path to bind the middleware to
	// use the same as in webpack

	headers: { "X-Custom-Header": "yes" },
	// custom headers

	stats: {
		colors: true
	}
	// options for formating the statistics

	serverSideRender: false,
	// Turn off the server-side rendering mode. See Server-Side Rendering part for more info.
}));
```

## Advanced API

This part shows how you might interact with the middleware during runtime:

* `close(callback)` - stop watching for file changes
	```js
	var webpackDevMiddlewareInstance = webpackMiddleware(/* see example usage */);
	app.use(webpackDevMiddlewareInstance);
	// After 10 seconds stop watching for file changes:
	setTimeout(function(){
	  webpackDevMiddlewareInstance.close();
	}, 10000);
	```

* `invalidate()` - recompile the bundle - e.g. after you changed the configuration
	```js
	var compiler = webpack(/* see example usage */);
	var webpackDevMiddlewareInstance = webpackMiddleware(compiler);
	app.use(webpackDevMiddlewareInstance);
	setTimeout(function(){
	  // After a short delay the configuration is changed
	  // in this example we will just add a banner plugin:
	  compiler.apply(new webpack.BannerPlugin('A new banner'));
	  // Recompile the bundle with the banner plugin:
	  webpackDevMiddlewareInstance.invalidate();
	}, 1000);
	```

* `waitUntilValid(callback)` - executes the `callback` if the bundle is valid or after it is valid again:
	```js
	var webpackDevMiddlewareInstance = webpackMiddleware(/* see example usage */);
	app.use(webpackDevMiddlewareInstance);
	webpackDevMiddlewareInstance.waitUntilValid(function(){
	  console.log('Package is in a valid state');
	});
	```

## Server-Side Rendering
In order to develop a server-side rendering application, we need access to the [`stats`](https://github.com/webpack/docs/wiki/node.js-api#stats), which is generated with the latest build.

In the server-side rendering mode, __webpack-dev-middleware__ sets the `stat` to `res.locals.webpackStats`, then call `next()` to trigger the next middleware, where we can render pages and response to clients. During the webpack building process, all requests will be pending until the build is finished and the `stat` is available.

```JavaScript
app.use(webpackMiddleware(compiler, { serverSideRender: true })

// The following middleware would not be invoked until the latest build is finished.
app.use((req, res) => {
  const  assetsByChunkName = res.locals.webpackStats.toJson().assetsByChunkName
  // then use `assetsByChunkName` for server-sider rendering
})
```
