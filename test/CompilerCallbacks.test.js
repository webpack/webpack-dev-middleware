var should = require("should");
var middleware = require("../middleware");
require("mocha-sinon");

describe("CompilerCallbacks", function() {
	var plugins = {};
	var compiler = {
		watch: function() {},
		plugin: function(name, callback) {
			plugins[name] = callback;
		}
	};
	beforeEach(function() {
		plugins = {};
	});

	it("watch error should be reported to console", function(done) {
		var error = new Error("Oh noes!");
		this.sinon.stub(compiler, "watch").callsFake(function(opts, callback) {
			callback(error);
		});
		this.sinon.stub(console, "error");
		middleware(compiler);
		should.strictEqual(console.error.callCount, 1);
		should.strictEqual(console.error.calledWith(error.stack), true);
		done();
	});

	it("options.error should be used on watch error", function(done) {
		this.sinon.stub(compiler, "watch").callsFake(function(opts, callback) {
			callback(new Error("Oh noes!"));
		});
		middleware(compiler, {
			error: function(err) {
				err.should.startWith("Error: Oh noes!");
				done();
			}
		});
	});
});
