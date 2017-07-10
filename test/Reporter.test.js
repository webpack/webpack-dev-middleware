var middleware = require("../middleware");
var should = require("should");
var fs = require("fs");
var path = require("path");
var timestamp = require("time-stamp");
require("mocha-sinon");

var extendedStats = fs.readFileSync(path.join(__dirname, "fixtures", "stats.txt"), "utf8");

var simpleStats = {
	hasErrors: function() {
		return false;
	},
	hasWarnings: function() {
		return false;
	}
};

var errorStats = {
	hasErrors: function() {
		return true;
	},
	hasWarnings: function() {
		return false;
	}
};

var warningStats = {
	hasErrors: function() {
		return false;
	},
	hasWarnings: function() {
		return true;
	}
};

describe("Reporter", function() {
	var plugins = {};
	var compiler = {
		watch: function() {
			return {
				invalidate: function() {}
			};
		},
		plugin: function(name, callback) {
			plugins[name] = callback;
		}
	};
	beforeEach(function() {
		plugins = {};
		this.sinon.stub(console, "log");
		this.sinon.stub(console, "warn");
		this.sinon.stub(console, "error");
	});

	describe("compilation messages", function() {
		it("should show 'compiled successfully' message", function(done) {
			middleware(compiler);

			plugins.done(simpleStats);
			setTimeout(function() {

				should.strictEqual(console.log.callCount, 2);
				should.strictEqual(console.warn.callCount, 0);
				should.strictEqual(console.error.callCount, 0);
				should.strictEqual(console.log.calledWith("webpack: Compiled successfully."), true);
				done();
			});
		});

		it("should show 'Failed to compile' message in console.error", function(done) {
			middleware(compiler);

			plugins.done(errorStats);
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 1);
				should.strictEqual(console.warn.callCount, 0);
				should.strictEqual(console.error.callCount, 1);
				should.strictEqual(console.log.calledWith("webpack: Failed to compile."), true);
				done();
			});
		});

		it("should show compiled successfully message, with log time", function(done) {
			middleware(compiler, {
				reportTime: true
			});

			plugins.done(simpleStats);
			setTimeout(function() {

				should.strictEqual(console.log.callCount, 2);
				should.strictEqual(console.log.calledWith("[" + timestamp("HH:mm:ss") + "] webpack: Compiled successfully."), true);
				done();
			});
		});

		it("should show compiled successfully message, with log time", function(done) {
			middleware(compiler, {
				reportTime: true
			});

			plugins.done(errorStats);
			setTimeout(function() {
				should.strictEqual(console.log.calledWith("[" + timestamp("HH:mm:ss") + "] webpack: Failed to compile."), true);
				done();
			});
		});

		it("should show compiled with warnings message", function(done) {
			middleware(compiler);

			plugins.done(warningStats);
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 1);
				should.strictEqual(console.warn.callCount, 1);
				should.strictEqual(console.error.callCount, 0);
				should.strictEqual(console.log.calledWith("webpack: Compiled with warnings."), true);
				done();
			});
		});

		it("should show compiled with warnings message, with log time", function(done) {
			middleware(compiler, {
				reportTime: true
			});

			plugins.done(warningStats);
			setTimeout(function() {
				should.strictEqual(console.log.calledWith("[" + timestamp("HH:mm:ss") + "] webpack: Compiled with warnings."), true);
				done();
			});
		});

		it("should not show valid message if options.quiet is given", function(done) {
			middleware(compiler, { quiet: true });

			plugins.done(simpleStats);
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 0);
				done();
			});
		});

		it("should not show valid message if options.noInfo is given", function(done) {
			middleware(compiler, { noInfo: true });

			plugins.done(simpleStats);
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 0);
				done();
			});
		});

		it("should show invalid message", function(done) {
			middleware(compiler);
			plugins.done(simpleStats);
			plugins.invalid();
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 1);
				should.strictEqual(console.log.calledWith("webpack: Compiling..."), true);
				done();
			});
		});

		it("should show invalid message, with log time", function(done) {
			middleware(compiler, {
				reportTime: true
			});
			plugins.done(simpleStats);
			plugins.invalid();
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 1);
				should.strictEqual(console.log.calledWith("[" + timestamp("HH:mm:ss") + "] webpack: Compiling..."), true);
				done();
			});
		});

		it("should not show invalid message if options.noInfo is given", function(done) {
			middleware(compiler, { noInfo: true });

			plugins.done(simpleStats);
			plugins.invalid();
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 0);
				done();
			});
		});

		it("should not show invalid message if options.quiet is given", function(done) {
			middleware(compiler, { quiet: true });

			plugins.done(simpleStats);
			plugins.invalid();
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 0);
				done();
			});
		});
	});

	describe("stats output", function() {
		var stats = {
			hasErrors: function() {
				return false;
			},
			hasWarnings: function() {
				return false;
			},
			toString: function() {
				return extendedStats;
			}
		};

		it("should print stats", function(done) {
			middleware(compiler);

			plugins.done(stats);
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 2);
				should.strictEqual(console.log.calledWith(stats.toString()), true);
				done();
			});
		});

		it("should not print stats if options.stats is false", function(done) {
			middleware(compiler, { stats: false });

			plugins.done(stats);
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 1);
				done();
			});
		});

		it("should not print stats if options.quiet is true", function(done) {
			middleware(compiler, { quiet: true });

			plugins.done(stats);
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 0);
				done();
			});
		});

		it("should not print stats if options.noInfo is true", function(done) {
			middleware(compiler, { noInfo: true });

			plugins.done(stats);
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 0);
				done();
			});
		});
	});

	describe("wait until bundle valid", function() {
		it("should print message", function(done) {
			var instance = middleware(compiler);

			plugins.invalid();
			instance.invalidate(function myInvalidateFunction() {});
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 1);
				should.strictEqual(console.log.calledWith("webpack: wait until bundle finished: myInvalidateFunction"), true);
				done();
			});
		});

		it("should not print if options.quiet is true", function(done) {
			var instance = middleware(compiler, { quiet: true });

			plugins.invalid();
			instance.invalidate();
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 0);
				done();
			});
		});

		it("should not print if options.noInfo is true", function(done) {
			var instance = middleware(compiler, { noInfo: true });

			plugins.invalid();
			instance.invalidate();
			setTimeout(function() {
				should.strictEqual(console.log.callCount, 0);
				done();
			});
		});
	});

	describe("custom reporter", function() {
		it("should allow a custom reporter", function(done) {
			middleware(compiler, {
				reporter: function(reporterOptions) {
					should.strictEqual(reporterOptions.state, true);
					should(reporterOptions.stats).be.ok();
					should(reporterOptions.options).be.ok();
					done();
				}
			});

			plugins.done(simpleStats);
		});
	});
});
