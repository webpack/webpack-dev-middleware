var should = require("should");
var getFilenameFromUrl = require("../lib/GetFilenameFromUrl");

function testUrl(options) {
	var url = getFilenameFromUrl(options.publicPath, options.outputPath, options.url);
	should.strictEqual(url, options.expected);
}

describe("GetFilenameFromUrl", function() {
	it("should handle urls", function() {
		var results = [
			{
				url: "/foo.js",
				outputPath: "/",
				publicPath: "/",
				expected: "/foo.js"
			}, {
				url: "/0.19dc5d417382d73dd190.hot-update.js",
				outputPath: "/",
				publicPath: "http://localhost:8080/",
				expected: "/0.19dc5d417382d73dd190.hot-update.js"
			}, {
				url: "/bar.js",
				outputPath: "/",
				publicPath: "https://localhost:8080/",
				expected: "/bar.js"
			}, {
				url: "/test.html?foo=bar",
				outputPath: "/",
				publicPath: "/",
				expected: "/test.html",
			}, {
				url: "/a.js",
				outputPath: "/dist",
				publicPath: "/",
				expected: "/dist/a.js",
			}, {
				url: "/b.js",
				outputPath: "/",
				publicPath: undefined,
				expected: "/b.js",
			}, {
				url: "/c.js",
				outputPath: undefined,
				publicPath: undefined,
				expected: "/c.js",
			}, {
				url: "/more/complex/path.js",
				outputPath: "/a",
				publicPath: "/",
				expected: "/a/more/complex/path.js",
			}, {
				url: "/more/complex/path.js",
				outputPath: "/a",
				publicPath: "/complex",
				expected: false,
			}, {
				url: "c.js",
				outputPath: "/dist",
				publicPath: "/",
				expected: false, // publicPath is not in url, so it should fail
			}, {
				url: "/bar/",
				outputPath: "/foo",
				publicPath: "/bar/",
				expected: "/foo",
			}, {
				url: "/bar/",
				outputPath: "/",
				publicPath: "http://localhost/foo/",
				expected: false,
			}, {
				url: "http://test.domain/test/sample.js",
				outputPath: "/",
				publicPath: "/test/",
				expected: "/sample.js"
			}, {
				url: "http://test.domain/test/sample.js",
				outputPath: "/",
				publicPath: "http://other.domain/test/",
				expected: false
			}, {
				url: "/protocol/relative/sample.js",
				outputPath: "/",
				publicPath: "//test.domain/protocol/relative/",
				expected: "/sample.js"
			}
		];
		results.forEach(testUrl);
	});
});
