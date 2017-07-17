/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
var mime = require("mime");
var getFilenameFromUrl = require("./lib/GetFilenameFromUrl");
var Shared = require("./lib/Shared");
var pathJoin = require("./lib/PathJoin");

// constructor for the middleware
var exports = function(compiler, options) {

	var context = {
		state: false,
		webpackStats: undefined,
		callbacks: [],
		options: options,
		compiler: compiler,
		watching: undefined,
		forceRebuild: false
	};
	var shared = Shared(context);

	// The middleware function
	function webpackDevMiddleware(req, res, next) {
		function goNext() {
			if(!context.options.serverSideRender) return next();
			return new Promise(function(resolve) {
				shared.ready(function() {
					res.locals.webpackStats = context.webpackStats;
					resolve(next());
				}, req);
			});
		}

		if(req.method !== "GET") {
			return goNext();
		}

		var filename = getFilenameFromUrl(context.options.publicPath, context.compiler, req.url);
		if(filename === false) return goNext();

		return new Promise(function(resolve) {
			shared.handleRequest(filename, processRequest, req);
			function processRequest() {
				try {
					var stat = context.fs.statSync(filename);
					if(!stat.isFile()) {
						if(stat.isDirectory()) {
							var index = context.options.index;

							if(index === undefined || index === true) {
								index = "index.html";
							} else if(!index) {
								throw "next";
							}

							filename = pathJoin(filename, index);
							stat = context.fs.statSync(filename);
							if(!stat.isFile()) throw "next";
						} else {
							throw "next";
						}
					}
				} catch(e) {
					return resolve(goNext());
				}

				// server content
				var content = context.fs.readFileSync(filename);
				content = shared.handleRangeHeaders(content, req, res);
				res.setHeader("Content-Type", mime.lookup(filename) + "; charset=UTF-8");
				res.setHeader("Content-Length", content.length);
				if(context.options.headers) {
					for(var name in context.options.headers) {
						res.setHeader(name, context.options.headers[name]);
					}
				}
				// Express automatically sets the statusCode to 200, but not all servers do (Koa).
				res.statusCode = res.statusCode || 200;
				if(res.send) res.send(content);
				else res.end(content);
				resolve();
			}
		});
	}

	webpackDevMiddleware.getFilenameFromUrl = getFilenameFromUrl.bind(this, context.options.publicPath, context.compiler);
	webpackDevMiddleware.waitUntilValid = shared.waitUntilValid;
	webpackDevMiddleware.invalidate = shared.invalidate;
	webpackDevMiddleware.close = shared.close;
	webpackDevMiddleware.fileSystem = context.fs;
	return webpackDevMiddleware;
};

exports.webpackKoaMiddleware = function(compiler, options) {

	var context = {
		state: false,
		webpackStats: undefined,
		callbacks: [],
		options: options,
		compiler: compiler,
		watching: undefined,
		forceRebuild: false
	};
	var shared = Shared(context);

	// The middleware function
	function webpackDevMiddleware(ctx, next) {
		var req = ctx.req;
		var res = ctx.res;
		function goNext() {
			if(!context.options.serverSideRender) return next();
			return new Promise(function(resolve) {
				shared.ready(function() {
					ctx.state.webpackStats = context.webpackStats;
					resolve(next());
				}, req);
			});
		}

		if(ctx.method !== "GET") {
			return goNext();
		}

		var filename = getFilenameFromUrl(context.options.publicPath, context.compiler, ctx.url);
		if(filename === false) return goNext();

		return new Promise(function(resolve) {
			shared.handleRequest(filename, processRequest, req);
			function processRequest() {
				try {
					var stat = context.fs.statSync(filename);
					if(!stat.isFile()) {
						if(stat.isDirectory()) {
							var index = context.options.index;

							if(index === undefined || index === true) {
								index = "index.html";
							} else if(!index) {
								throw "next";
							}

							filename = pathJoin(filename, index);
							stat = context.fs.statSync(filename);
							if(!stat.isFile()) throw "next";
						} else {
							throw "next";
						}
					}
				} catch(e) {
					return resolve(goNext());
				}

				// server content
				var content = context.fs.readFileSync(filename);
				content = shared.handleRangeHeaders(content, req, res);
				ctx.set("Content-Type", mime.lookup(filename) + "; charset=UTF-8");
				ctx.set("Content-Length", content.length);
				if(context.options.headers) {
					for(var name in context.options.headers) {
						ctx.set(name, context.options.headers[name]);
					}
				}
				// Express automatically sets the statusCode to 200, but not all servers do (Koa).
				ctx.status = ctx.status === 404 ? 200 : ctx.status;
				ctx.body = content;
				resolve();
			}
		});
	}

	webpackDevMiddleware.getFilenameFromUrl = getFilenameFromUrl.bind(this, context.options.publicPath, context.compiler);
	webpackDevMiddleware.waitUntilValid = shared.waitUntilValid;
	webpackDevMiddleware.invalidate = shared.invalidate;
	webpackDevMiddleware.close = shared.close;
	webpackDevMiddleware.fileSystem = context.fs;
	return webpackDevMiddleware;
};

module.exports = exports;
