/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
'use strict';
var MemoryFileSystem = require("memory-fs");
var mime = require("mime");
var parseRange = require("range-parser");

var HASH_REGEXP = /[0-9a-f]{10,}/;

// constructor for the middleware
module.exports = function(compiler, options) {
	if(!options) options = {};
	if(typeof options.watchOptions === "undefined") options.watchOptions = {};
	if(typeof options.watchDelay !== "undefined") {
		// TODO remove this in next major version
		console.warn("options.watchDelay is deprecated: Use 'options.watchOptions.aggregateTimeout' instead");
		options.watchOptions.aggregateTimeout = options.watchDelay;
	}
	if(typeof options.watchOptions.aggregateTimeout === "undefined") options.watchOptions.aggregateTimeout = 200;
	if(typeof options.stats === "undefined") options.stats = {};
	if(!options.stats.context) options.stats.context = process.cwd();
	if(options.lazy) {
		if(typeof options.filename === "string") {
			var str = options.filename
				.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
				.replace(/\\\[[a-z]+\\\]/ig, ".+");
			options.filename = new RegExp("^[\/]{0,1}" + str + "$");
		}
	}

	// store our files in memory
	var files = {};
	var fs = compiler.outputFileSystem = new MemoryFileSystem();

	compiler.plugin("done", function(stats) {
		// We are now on valid state
		state = true;
		// Do the stuff in nextTick, because bundle may be invalidated
		//  if a change happend while compiling
		process.nextTick(function() {
			// check if still in valid state
			if(!state) return;
			// print webpack output
			var displayStats = (!options.quiet && options.stats !== false);
			if(displayStats &&
				!(stats.hasErrors() || stats.hasWarnings()) &&
				options.noInfo)
				displayStats = false;
			if(displayStats) {
				console.log(stats.toString(options.stats));
			}
			if (!options.noInfo && !options.quiet)
				console.info("webpack: bundle is now VALID.");

			// execute callback that are delayed
			var cbs = callbacks;
			callbacks = [];
			cbs.forEach(function continueBecauseBundleAvailible(cb) {
				cb();
			});
		});

		// In lazy mode, we may issue another rebuild
		if(forceRebuild) {
			forceRebuild = false;
			rebuild();
		}
	});

	// on compiling
	function invalidPlugin() {
		if(state && (!options.noInfo && !options.quiet))
			console.info("webpack: bundle is now INVALID.");
		// We are now in invalid state
		state = false;
	}
	function invalidAsyncPlugin(compiler, callback) {
		invalidPlugin();
		callback();
	}
	compiler.plugin("invalid", invalidPlugin);
	compiler.plugin("watch-run", invalidAsyncPlugin);
	compiler.plugin("run", invalidAsyncPlugin);

	// the state, false: bundle invalid, true: bundle valid
	var state = false;

	// in lazy mode, rebuild automatically
	var forceRebuild = false;

	// delayed callback
	var callbacks = [];

	// wait for bundle valid
	function ready(fn, req) {
		if(state) return fn();
		if(!options.noInfo && !options.quiet)
			console.log("webpack: wait until bundle finished: " + (req.url || fn.name));
		callbacks.push(fn);
	}

	// start watching
	if(!options.lazy) {
		var watching = compiler.watch(options.watchOptions, function(err) {
			if(err) throw err;
		});
	} else {
		state = true;
	}

	function rebuild() {
		if(state) {
			state = false;
			compiler.run(function(err) {
				if(err) throw err;
			});
		} else {
			forceRebuild = true;
		}
	}

	function pathJoin(a, b) {
		return a == "/" ? "/" + b : (a||"") + "/" + b
	}

	function getFilenameFromUrl(url) {
		// publicPrefix is the folder our bundle should be in
		var localPrefix = options.publicPath || "/";
		if(url.indexOf(localPrefix) !== 0) {
			if(/^(https?:)?\/\//.test(localPrefix)) {
				localPrefix = "/" + localPrefix.replace(/^(https?:)?\/\/[^\/]+\//, "");
				// fast exit if another directory requested
				if(url.indexOf(localPrefix) !== 0) return false;
			} else return false;
		}
		// get filename from request
		var filename = url.substr(localPrefix.length);
		if(filename.indexOf("?") >= 0) {
			filename = filename.substr(0, filename.indexOf("?"));
		}
		return filename ? pathJoin(compiler.outputPath, filename) : compiler.outputPath;
	}

	function handleRangeHeaders(content, req, res) {
		if (req.headers['Accept-Ranges']) res.setHeader('Accept-Ranges', 'bytes');
		if (req.headers.range) {
			var ranges = parseRange(content.length, req.headers.range);

			// unsatisfiable
			if (-1 == ranges) {
				res.setHeader('Content-Range', 'bytes */' + content.length);
				res.statusCode = 416;
				return content;
			}

			// valid (syntactically invalid/multiple ranges are treated as a regular response)
			if (-2 != ranges && ranges.length === 1) {
				// Content-Range
				res.statusCode = 206;
				var length = content.length;
				res.setHeader(
					'Content-Range',
					'bytes ' + ranges[0].start + '-' + ranges[0].end + '/' + length
				);

				content = content.slice(ranges[0].start, ranges[0].end + 1);
			}
		}
		return content;
	}

	function processRequest(filename, res) {
		var setHeader = options.koa ? this.set.bind(this) : res.setHeader.bind(res);

		var stat = fs.statSync(filename);
		if(!stat.isFile()) {
			if (stat.isDirectory()) {
				filename = pathJoin(filename, "index.html");
				stat = fs.statSync(filename);
				if(!stat.isFile()) throw "next";
			} else {
				throw "next";
			}
		}
		// server content
		var content = fs.readFileSync(filename);
		content = handleRangeHeaders(content, this.req, this.res);
		setHeader("Access-Control-Allow-Origin", "*"); // To support XHR, etc.
		setHeader("Content-Type", mime.lookup(filename));
		setHeader("Content-Length", content.length);
		if(options.headers) {
			for(var name in options.headers) {
				setHeader(name, options.headers[name]);
			}
		}
		if (options.koa) return this.body = content;

		if (res.send) res.send(content);
		else res.end(content);

	}
	
	function checkLazyMode(filename) {
		return options.lazy && (!options.filename || options.filename.test(filename));
	}

	function checkFileName(filename) {
		if(!HASH_REGEXP.test(filename)) return false;
		try {
			return fs.statSync(filename).isFile();
		} catch(e) {}
	}
	// The middleware function
	function expressWebpackDevMiddleware(req, res, next) {
		var filename = getFilenameFromUrl(req.url);
		var requestHandler = processRequest.bind(null, filename, res);
		
		if (filename === false) return next();
		// in lazy mode, rebuild on bundle request
		if(checkLazyMode(filename)) rebuild();

		if(checkFileName(filename)) return requestHandler();
		// delay the request until we have a vaild bundle
		try {
			ready(requestHandler, req);
		}
		catch(err) {
			if (err == 'next') return next();
			console.log(err);
		}
	}

	function* koaWebpackDevMiddleware(next) {
		var filename = getFilenameFromUrl(this.url);
		var requestHandler = processRequest.bind(this, filename);
		
		if (filename === false) return yield next;

		// in lazy mode, rebuild on bundle request
		if(checkLazyMode(filename)) rebuild();

		if(checkFileName(filename)) return requestHandler();
		// delay the request until we have a vaild bundle
		try {
			ready(requestHandler, this.req);
		}
		catch(err) {
			if (err == 'next') return yield next;
			console.log(err);
		}
	}

	var webpackDevMiddleware = !options.koa ? expressWebpackDevMiddleware : koaWebpackDevMiddleware;

	webpackDevMiddleware.getFilenameFromUrl = getFilenameFromUrl;

	webpackDevMiddleware.waitUntilValid = function(callback) {
		callback = callback || function(){};
		if (!watching || !watching.running) callback();
		else ready(callback, {});
	};

	webpackDevMiddleware.invalidate = function(callback) {
		callback = callback || function(){};
		if(watching) {
			ready(callback, {});
			watching.invalidate();
		} else {
			callback();
		}
	};

	webpackDevMiddleware.close = function(callback) {
		callback = callback || function(){};
		if(watching) watching.close(callback);
		else callback();
	};

	webpackDevMiddleware.fileSystem = fs;

	return webpackDevMiddleware;

}
