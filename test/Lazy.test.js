var should = require("should");
var middleware = require("../middleware");
require("mocha-sinon");

var doneStats = {
	hasErrors: function() {
		return false;
	},
	hasWarnings: function() {
		return false;
	}
};

describe("Lazy mode", function() {
	var compiler = {
		plugin: function(name, callback) {
			plugins[name] = callback;
		}
	};
	var instance;
	var next;
	var res = {};

	var plugins = [];
	beforeEach(function() {
		plugins = {};
		compiler.run = this.sinon.stub();
		next = this.sinon.stub();
	});

	describe("builds", function() {
		var req = { method: "GET", url: "/bundle.js" };
		beforeEach(function() {
			this.sinon.stub(console, "error");
			instance = middleware(compiler, { lazy: true, quiet: true });
		});
		it("should trigger build", function(done) {
			instance(req, res, next);
			should.strictEqual(compiler.run.callCount, 1);
			plugins.done(doneStats);
			setTimeout(function() {
				should.strictEqual(next.callCount, 1);
				done();
			});
		});

		it("should trigger rebuild when state is invalidated", function(done) {
			plugins.invalid();
			instance(req, res, next);
			plugins.done(doneStats);

			should.strictEqual(compiler.run.callCount, 1);
			setTimeout(function() {
				should.strictEqual(next.callCount, 0);
				done();
			});
		});

		it("should pass through compiler error", function(done) {
			var error = new Error("MyCompilerError");
			compiler.run.callsArgWith(0, error);
			instance(req, res, next);
			should.strictEqual(console.error.callCount, 1);
			should.strictEqual(console.error.calledWith(error.stack), true);
			done();
		});
	});

	describe("custom filename", function() {
		it("should trigger build", function() {
			instance = middleware(compiler, { lazy: true, quiet: true, filename: "foo.js" });

			var req = { method: "GET", url: "/bundle.js" };
			instance(req, res, next);
			should.strictEqual(compiler.run.callCount, 0);

			req = { method: "GET", url: "/foo.js" };
			instance(req, res, next);
			should.strictEqual(compiler.run.callCount, 1);
		});

		it("should allow prepended slash", function() {
			var options = { lazy: true, quiet: true, filename: "/foo.js" };
			instance = middleware(compiler, options);

			var req = { method: "GET", url: "/foo.js" };
			instance(req, res, next);
			should.strictEqual(compiler.run.callCount, 1);
		});
	});
});
