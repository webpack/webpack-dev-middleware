# webpack-dev-middleware

**THIS MIDDLEWARE SHOULD ONLY USED FOR DEVELOPMENT!**

**DO NOT USE IT IN PRODUCTION!**

## What is it?

It's a simple wrapper middleware for webpack. It serves the files emitted from webpack over a connect server.

It has a few advantages over bundling it as files:

* No files are written to disk, it handle the files in memory
* If files changed in watch mode, the middleware no longer serves the old bundle, but delays requests until the compiling has finished. You don't have to wait before refreshing the page after a file modification.
* I may add some specifiy optimation in future releases.

## Usage

``` javascript
var webpackMiddleware = require("webpack-dev-middleware");
app.use(webpackMiddleware(...));
```

Example usage:

``` javascript
app.use(webpackMiddleware(/* context = */ __dirname, /* module = */ "./lib/file", {
	// all options optional, but options object not

	noInfo: false,
	// display no info to console (only warnings and errors)

	quiet: false,
	// display nothing to the console

	colors: true,
	// colorful webpack stats

	verbose: false,
	// verbose webpack stats

	context: "/home/user",
	// context for webpack stats

	headers: { "X-Custom-Header": "yes" },
	// custom headers

	// webpack options
	webpack: {
		watch: true,
		// This is not required, but recommendated to get the best out of the middleware.
		// If you pass false, the middleware switch to lazy mode, which means rebundling
		// every request. A cache is automatically attached in lazy mode.

		publicPrefix: "http://localhost:8080/assets/",
		// The prefix for request that should be handled.

		output: "bundle.js",
		// The filename for the bundle.

		// ... more webpack config options
		debug: true,
		outputPostfix: ".bundle.js",
	}
}));
```
