# webpack-dev-middleware

**THIS MIDDLEWARE SHOULD ONLY USED FOR DEVELOPMENT!**

**DO NOT USE IT IN PRODUCTION!**

## What is it?

It's a simple wrapper middleware for webpack. It serves the files emitted from webpack over a connect server.

It has a few advantages over bundling it as files:

* No files are written to disk, it handle the files in memory
* If files changed in watch mode, the middleware no longer serves the old bundle, but delays requests until the compiling has finished. You don't have to wait before refreshing the page after a file modification.
* I may add some specific optimization in future releases.

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
	// all options optional

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
}));
```

## FAQ

### How do I use it with the HTML5 History API?

webpack-dev-middleware has an API which exposes the in-memory filesystem, which can be used to serve webpack-generated files.

```js
const middleware = require('webpack-dev-middleware')(compiler)
// normal middleware code here
app.get('*', (req, res) => res.end(middleware.fileSystem.readFileSync(path.join(config.output.path, 'index.html')))
```

See more in this [gist](https://gist.github.com/frederickfogerty/df921f21a83b479b2056). For a more simple version, see [here](https://gist.github.com/maman/8e91e6cb4ca9feaa4290). Also see [issue #39](https://github.com/webpack/webpack-dev-middleware/issues/39) for discussion.
