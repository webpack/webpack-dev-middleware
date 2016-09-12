var middleware = require("../middleware");
var should = require("should");
require("mocha-sinon");

describe("Reporter", function() {
	var plugins = {};
	var compiler = {
		watch: function() {
			return {};
		},
		plugin: function(name, callback) {
			plugins[name] = callback;
		}
	};
	beforeEach(function() {
		plugins = {};
		this.sinon.stub(console, 'log');
		this.sinon.stub(console, 'info');
	});

	it("should show valid message", function(done) {
		middleware(compiler);
		var stats = {
			hasErrors: function() {
				return false;
			},
			hasWarnings: function() {
				return false;
			}
		};

		plugins.done(stats);
		setTimeout(function() {
			should.strictEqual(console.log.callCount, 1);
			// TODO: test stats output
			should.strictEqual(console.info.callCount, 1);
			should.strictEqual(console.info.calledWith("webpack: bundle is now VALID."), true);
			done();
		});
	});

	it("should show invalid message", function(done) {
		middleware(compiler);
		var stats = {
			hasErrors: function() {
				return false;
			},
			hasWarnings: function() {
				return false;
			}
		};

		plugins.done(stats);
		plugins.invalid();
		setTimeout(function() {
			should.strictEqual(console.info.callCount, 1);
			should.strictEqual(console.info.calledWith("webpack: bundle is now INVALID."), true);
			done();
		});
	});
});
