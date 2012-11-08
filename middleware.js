/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var webpack = require("webpack");
var formatOutput = require("webpack/lib/formatOutput");

// constructor for the middleware
module.exports = function(context, module, options) {
	// get to options, we may have 2 function prototypes
	// (absoluteModule, options) and (context, module, options)
	var opt = options || module;

	// We do the stuff in memory, so don't write
	opt.noWrite = true;

	// We need you own events to bind some stuff
	opt.events = opt.events || new (require("events").EventEmitter)();

	// Grap files from webpack
	opt.emitFile = function(filename, content) {
		files[filename] = content;
	}

	// on bundle
	opt.events.on("bundle", function(stats) {
		// We are now on valid state
		state = true;
		// Do the stuff in nextTick, because bundle may be invalidated
		//  if a change happend while compiling
		process.nextTick(function() {
			// check if still in valid state
			if(!state) return;
			// print webpack output
			var displayStats = !opt.middleware || !opt.middleware.quiet;
			if(displayStats &&
				!(stats.errors && stats.errors.length > 0 || stats.warnings && stats.warnings.length > 0) &&
				opt.middleware && opt.middleware.noInfo)
				displayStats = false;
			if(displayStats) {
				console.log(formatOutput(stats, {
					context: opt.context || context || process.cwd(),
					colors: true,
					verbose: opt.verbose
				}));
			}
			if(!opt.middleware || (!opt.middleware.noInfo && !opt.middleware.quiet))
				console.info("webpack: bundle is now VALID.");

			// execute callback that are delayed
			var cbs = callbacks;
			callbacks = [];
			cbs.forEach(function continueBecauseBundleAvailible(cb) {
				cb();
			});
		});
	});

	// on bundle invalidated
	opt.events.on("bundle-invalid", function() {
		if(state && (!opt.middleware || (!opt.middleware.noInfo && !opt.middleware.quiet)))
			console.info("webpack: bundle is now invalid.");
		// We are now in invalid state
		state = false;
	});

	// start webpack
	var args = Array.prototype.slice.call(arguments);
	args.push(function(err) {
		if(err) throw err;
	});
	webpack.apply(null, args);

	// store our files in memory
	var files = {};

	// the state, false: bundle invalid, true: bundle valid
	var state = false;

	// delayed callback
	var callbacks = [];

	// wait for bundle valid
	function ready(fn, req) {
		if(state) return fn();
		if(!opt.middleware || (!opt.middleware.noInfo && !opt.middleware.quiet))
			console.log("webpack: wait until bundle finished: " + req.url);
		callbacks.push(fn);
	}

	// The middleware function
	return function webpackDevMiddleware(req, res, next) {
		// publicPrefix ist the folder our bundle should be in
		var localPrefix = opt.publicPrefix || "";
		if(/^https?:\/\//.test(localPrefix)) {
			localPrefix = localPrefix.replace(/^https?:\/\/[^\/]+\//, "");
		}
		// fast exit if another directory requested
		if(req.url.indexOf("/" + localPrefix) != 0) return next();
		// else delay the request until we have a vaild bundle
		ready(function() {
			// get filename from request
			var filename = req.url.substr(localPrefix.length + 1);
			// check if it is a generated file
			if(!(filename in files)) return next();

			// server content
			var content = files[filename];
			res.setHeader("Access-Control-Allow-Origin", "*"); // To support XHR, etc.
			res.end(content);
		}, req);
	}
}