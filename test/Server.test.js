var middleware = require("../middleware");
var express = require("express");
var webpack = require("webpack");
var should = require("should");
var request = require("supertest");
var webpackConfig = require("./fixtures/server-test/webpack.config");


describe("Server", function() {
	var listen;
	var app;

	function listenShorthand(done) {
		return app.listen(8000, '127.0.0.1', function(err) {
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
			app.use(middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				publicPath: "/",
			}));
			listen = listenShorthand(done);
		});
		after(close);

		it("GET request to bundle file", function(done) {
			request(app).get("/bundle.js")
			.expect("Content-Type", "application/javascript")
			.expect("Content-Length", "2780")
			.expect("Access-Control-Allow-Origin", "*")
			.expect(200, /console\.log\("Hey\."\)/, done);
		});

		it("POST request to bundle file", function(done) {
			request(app).post("/bundle.js")
			.expect(404, done);
		});

		it("request to image", function(done) {
			request(app).get("/svg.svg")
			.expect("Content-Type", "image/svg+xml")
			.expect("Content-Length", "4778")
			.expect("Access-Control-Allow-Origin", "*")
			.expect(200, done);
		});

		it("request to non existing file", function(done) {
			request(app).get("/nope")
			.expect("Content-Type", "text/html; charset=utf-8")
			.expect(404, done);
		});

		it("request to directory", function(done) {
			request(app).get("/")
			.expect("Content-Type", "text/html")
			.expect("Content-Length", "10")
			.expect("Access-Control-Allow-Origin", "*")
			.expect(200, /My\ Index\./, done);
		});

		it("invalid range header", function(done) {
			request(app).get("/svg.svg")
			.set("Range", "bytes=6000-")
			.expect(416, done);
		});

		it("valid range header", function(done) {
			request(app).get("/svg.svg")
			.set("Range", "bytes=3000-3500")
			.expect("Content-Length", "501")
			.expect("Content-Range", "bytes 3000-3500/4778")
			.expect(206, done);
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
