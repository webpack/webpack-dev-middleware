var middleware = require("../middleware");
var express = require("express");
var webpack = require("webpack");
var should = require("should");
var request = require("supertest");
var webpackConfig = require("./fixtures/server-test/webpack.config");
var webpackMultiConfig = require("./fixtures/server-test/webpack.array.config");


describe("Server", function() {
	var listen;
	var app;

	function listenShorthand(done) {
		return app.listen(8000, "127.0.0.1", function(err) {
			if(err) done(err);
			done();
		});
	}

	function close(done) {
		if(listen) {
			listen.close(done);
		} else {
			done();
		}
	}

	describe("requests", function() {
		before(function(done) {
			app = express();
			var compiler = webpack(webpackConfig);
			var instance = middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				publicPath: "/public/",
			});
			app.use(instance);
			listen = listenShorthand(done);
			// Hack to add a mock HMR json file to the in-memory filesystem.
			instance.fileSystem.writeFileSync("/123a123412.hot-update.json", "[\"hi\"]");
		});
		after(close);

		it("GET request to bundle file", function(done) {
			request(app).get("/public/bundle.js")
				.expect("Content-Type", "application/javascript; charset=UTF-8")
				.expect("Content-Length", "2823")
				.expect(200, /console\.log\("Hey\."\)/, done);
		});

		it("POST request to bundle file", function(done) {
			request(app).post("/public/bundle.js")
				.expect(404, done);
		});

		it("request to image", function(done) {
			request(app).get("/public/svg.svg")
				.expect("Content-Type", "image/svg+xml; charset=UTF-8")
				.expect("Content-Length", "4778")
				.expect(200, done);
		});

		it("request to non existing file", function(done) {
			request(app).get("/public/nope")
				.expect("Content-Type", "text/html; charset=utf-8")
				.expect(404, done);
		});

		it("request to HMR json", function(done) {
			request(app).get("/public/123a123412.hot-update.json")
				.expect("Content-Type", "application/json; charset=UTF-8")
				.expect(200, /\[\"hi\"\]/, done);
		});

		it("request to directory", function(done) {
			request(app).get("/public/")
				.expect("Content-Type", "text/html; charset=UTF-8")
				.expect("Content-Length", "10")
				.expect(200, /My\ Index\./, done);
		});

		it("invalid range header", function(done) {
			request(app).get("/public/svg.svg")
				.set("Range", "bytes=6000-")
				.expect(416, done);
		});

		it("valid range header", function(done) {
			request(app).get("/public/svg.svg")
				.set("Range", "bytes=3000-3500")
				.expect("Content-Length", "501")
				.expect("Content-Range", "bytes 3000-3500/4778")
				.expect(206, done);
		});

		it("request to non-public path", function(done) {
			request(app).get("/nonpublic/")
				.expect("Content-Type", "text/html; charset=utf-8")
				.expect(404, done);
		});
	});

	describe("no index mode", function() {
		before(function(done) {
			app = express();
			var compiler = webpack(webpackConfig);
			app.use(middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				index: false,
				publicPath: "/",
			}));
			listen = listenShorthand(done);
		});
		after(close);

		it("request to directory", function(done) {
			request(app).get("/")
				.expect("Content-Type", "text/html; charset=utf-8")
				.expect(404, done);
		});
	});

	describe("lazy mode", function() {
		before(function(done) {
			app = express();
			var compiler = webpack(webpackConfig);
			app.use(middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				lazy: true,
				publicPath: "/",
			}));
			listen = listenShorthand(done);
		});
		after(close);

		it("GET request to bundle file", function(done) {
			request(app).get("/bundle.js")
				.expect("Content-Length", "2823")
				.expect(200, /console\.log\("Hey\."\)/, done);
		});
	});

	describe("custom headers", function() {
		before(function(done) {
			app = express();
			var compiler = webpack(webpackConfig);
			app.use(middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				headers: { "X-nonsense-1": "yes", "X-nonsense-2": "no" }
			}));
			listen = listenShorthand(done);
		});
		after(close);

		it("request to bundle file", function(done) {
			request(app).get("/bundle.js")
				.expect("X-nonsense-1", "yes")
				.expect("X-nonsense-2", "no")
				.expect(200, done);
		});
	});

	describe("custom mimeTypes", function() {
		before(function(done) {
			app = express();
			var compiler = webpack(webpackConfig);
			var instance = middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				index: "Index.phtml",
				mimeTypes: {
					"text/html": ["phtml"]
				}
			});
			app.use(instance);
			listen = listenShorthand(done);
			instance.fileSystem.writeFileSync("/Index.phtml", "welcome");
		});
		after(close);

		it("request to Index.phtml", function(done) {
			request(app).get("/")
				.expect("welcome")
				.expect("Content-Type", /text\/html/)
				.expect(200, done);
		});
	});

	describe("MultiCompiler", function() {
		before(function(done) {
			app = express();
			var compiler = webpack(webpackMultiConfig);
			var instance = middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				publicPath: "/"
			});
			app.use(instance);
			listen = listenShorthand(done);
		});
		after(close);

		it("request to both bundle files", function(done) {
			request(app).get("/js1/foo.js")
				.expect(200, function() {
					request(app).get("/js2/bar.js")
						.expect(200, done);
				});
		});
	});


	describe("server side render", function() {
		var locals;
		before(function(done) {
			app = express();
			var compiler = webpack(webpackConfig);
			app.use(middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				serverSideRender: true,
			}));
			app.use(function(req, res) {
				locals = res.locals;
				res.sendStatus(200);
			});
			listen = listenShorthand(done);
		});
		after(close);

		it("request to bundle file", function(done) {
			request(app).get("/foo/bar")
				.expect(200, function() {
					should.exist(locals.webpackStats);
					done();
				});
		});
	});
});
