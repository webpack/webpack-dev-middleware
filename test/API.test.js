var middleware = require("../middleware");
var should = require("should");

var options = {
	quiet: true,
	publicPath: "/public/"
};

describe("Advanced API", function() {

	var plugins = {};
	var invalidationCount = 0;
	var closeCount = 0;
	// TODO: Should use sinon or something for this...
	var compiler = {
		outputPath: "/output",
		watch: function() {
			return {
				invalidate: function() {
					invalidationCount += 1;
				},
				close: function(callback) {
					closeCount += 1;
					callback();
				}
			};
		},
		plugin: function(name, callback) {
			plugins[name] = callback;
		}
	};
	beforeEach(function() {
		plugins = {};
		invalidationCount = 0;
		closeCount = 0;
	});
	var doneStats = {
		hasErrors: function() {
			return false;
		},
		hasWarnings: function() {
			return false;
		}
	};

	describe("waitUntilValid", function() {
		it("should wait for bundle done", function(done) {
			var doneCalled = false;
			var instance = middleware(compiler, options);
			instance.waitUntilValid(function() {
				if(doneCalled) {
					done();
				} else {
					done(new Error("`waitUntilValid` called before bundle was done"));
				}
			});
			setTimeout(function() {
				plugins.done(doneStats);
				doneCalled = true;
			});
		});

		it("callback should be called when bundle is already done", function(done) {
			var instance = middleware(compiler, options);
			plugins.done(doneStats);
			setTimeout(function() {
				instance.waitUntilValid(function() {
					done();
				});
			});
		});

		it("should work without callback", function() {
			var instance = middleware(compiler, options);
			plugins.done(doneStats);
			setTimeout(function() {
				instance.waitUntilValid();
			});
		});

		it("callback should have stats argument", function(done) {
			var instance = middleware(compiler, options);
			plugins.done(doneStats);
			setTimeout(function() {
				instance.waitUntilValid(function(stats) {
					should(stats).have.keys("hasErrors", "hasWarnings");
					done();
				});
			});
		});
	});

	describe("invalidate", function() {
		it("should use callback immediately when in lazy mode", function(done) {
			var instance = middleware(compiler, { lazy: true, quiet: true });
			instance.invalidate(done);
		});

		it("should wait for bundle done", function(done) {
			var instance = middleware(compiler, options);
			var doneCalled = false;
			instance.invalidate(function() {
				if(doneCalled) {
					should.strictEqual(invalidationCount, 1);
					done();
				} else {
					done(new Error("`invalid` called before bundle was done"));
				}
			});
			setTimeout(function() {
				plugins.done(doneStats);
				doneCalled = true;
			});
		});

		it("should work without callback", function(done) {
			var instance = middleware(compiler, options);
			instance.invalidate();
			setTimeout(function() {
				should.strictEqual(invalidationCount, 1);
				done();
			});
		});
	});

	describe("close", function() {
		it("should use callback immediately when in lazy mode", function(done) {
			var instance = middleware(compiler, { lazy: true, quiet: true });
			instance.close(done);
		});

		it("should call close on watcher", function(done) {
			var instance = middleware(compiler, options);
			instance.close(function() {
				should.strictEqual(closeCount, 1);
				done();
			});
		});

		it("should call close on watcher without callback", function() {
			var instance = middleware(compiler, options);
			instance.close();
			should.strictEqual(closeCount, 1);
		});
	});

	describe("getFilenameFromUrl", function() {
		it("use publicPath and compiler.outputPath to parse the filename", function(done) {
			var instance = middleware(compiler, options);
			var filename = instance.getFilenameFromUrl("/public/index.html");
			should.strictEqual(filename, "/output/index.html");
			done();
		});
	});
});
