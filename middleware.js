/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var MemoryOutputFileSystem = require("webpack/lib/MemoryOutputFileSystem");
var MemoryInputFileSystem = require("enhanced-resolve/lib/MemoryInputFileSystem");
var mime = require("mime");

// constructor for the middleware
module.exports = function(compiler, options) {
	if(!options) options = {};
	if(options.watchDelay === undefined) options.watchDelay = 200;
	if(!options.stats) options.stats = {};
	if(!options.stats.context === undefined) options.stats.context = process.cwd();

	// store our files in memory
	var files = {};
	compiler.outputFileSystem = new MemoryOutputFileSystem(files);
	var fs = new MemoryInputFileSystem(files);

	compiler.plugin("done", function(stats) {
		// We are now on valid state
		state = true;
		// Do the stuff in nextTick, because bundle may be invalidated
		//  if a change happend while compiling
		process.nextTick(function() {
			// check if still in valid state
			if(!state) return;
			// print webpack output
			var displayStats = !options.quiet;
			if(displayStats &&
				!(stats.hasErrors() || stats.hasWarnings()) &&
				options.noInfo)
				displayStats = false;
			if(displayStats) {
				console.log(stats.toString(options.stats));
			}
			if(!options.noInfo && !options.quiet)
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
			console.info("webpack: bundle is now invalid.");
		// We are now in invalid state
		state = false;
	}
	compiler.plugin("invalid", invalidPlugin);
	compiler.plugin("compile", invalidPlugin);

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
			console.log("webpack: wait until bundle finished: " + req.url);
		callbacks.push(fn);
	}

	// start watching
	if(!options.lazy) {
		compiler.watch(options.watchDelay, function(err) {
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

	// The middleware function
	return function webpackDevMiddleware(req, res, next) {
		// publicPrefix ist the folder our bundle should be in
		var localPrefix = options.publicPath || "/";
		if(/^https?:\/\//.test(localPrefix)) {
			localPrefix = "/" + localPrefix.replace(/^https?:\/\/[^\/]+\//, "");
		}
		// fast exit if another directory requested
		if(req.url.indexOf(localPrefix) != 0) return next();
		// get filename from request
		var filename = req.url.substr(localPrefix.length);
		// in lazy mode, rebuild on bundle request
		if(options.lazy && filename === options.filename)
			rebuild();
		// delay the request until we have a vaild bundle
		ready(function() {
			// check if it is a generated file
			var fsPath = compiler.outputPath == "/" ? "/" + filename : (compiler.outputPath||"") + "/" + filename;
			try {
				var stat = fs.statSync(fsPath);
				if(!stat.isFile()) throw "next";
			} catch(e) {
				return next();
			}

			// server content
			var content = fs.readFileSync(fsPath);
			res.setHeader("Access-Control-Allow-Origin", "*"); // To support XHR, etc.
			res.setHeader("Content-Type", mime.lookup(fsPath));
			if(options.headers) {
				for(var name in options.headers) {
					res.setHeader(name, options.headers[name]);
				}
			}
			res.end(content);
		}, req);
	}
}