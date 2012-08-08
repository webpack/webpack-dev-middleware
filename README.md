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

Use the `webpackMiddleware` function like the webpack function, but without callback.
Example usage:

``` javascript
app.use(webpackMiddleware(__dirname, "./lib/file", {
	watch: true,
	debug: true,
	publicPrefix: "http://localhost:8080/assets/",
	output: "bundle.js",
	outputPostfix: ".bundle.js",
	// ... more webpack config options
}));
```

### options.watch = true

This is not required, but recommendated to get the best out of the middleware.

### options.publicPrefix

The prefix for request that should be handled.

### options.output, options.outputPostfix

The filename for the bundle.

### options.verbose

Verbose output of the statistics.

### All other options like webpack