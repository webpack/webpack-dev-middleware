var pathJoin = require("./PathJoin");
var urlParse = require("url").parse;

function getFilenameFromUrl(publicPath, outputPath, url) {
	var filename;

	var publicPathArray;
	if(Array.isArray(publicPath)) {
		publicPathArray = publicPath;
	} else {
		publicPathArray = [publicPath];
	}
	for(var i = 0; i < publicPathArray.length; i++) {
		var checkedPublicPath = publicPathArray[i];
		// localPrefix is the folder our bundle should be in
		var localPrefix = urlParse(checkedPublicPath || "/", false, true);
		var urlObject = urlParse(url);

		// checkedPublicPath has the hostname that is not the same as request url's, should fail
		if(localPrefix.hostname !== null && urlObject.hostname !== null &&
			localPrefix.hostname !== urlObject.hostname) {
			continue;
		}

		// checkedPublicPath is not in url, so it should fail
		if(checkedPublicPath && localPrefix.hostname === urlObject.hostname && url.indexOf(checkedPublicPath) !== 0) {
			continue;
		}

		// strip localPrefix from the start of url
		if(urlObject.pathname.indexOf(localPrefix.pathname) === 0) {
			filename = urlObject.pathname.substr(localPrefix.pathname.length);
		}

		if(!urlObject.hostname && localPrefix.hostname &&
			url.indexOf(localPrefix.path) !== 0) {
			continue;
		}
		// and if not match, use outputPath as filename
		return decodeURIComponent(filename ? pathJoin(outputPath, filename) : outputPath);
	}
	return false;
}

// support for multi-compiler configuration
// see: https://github.com/webpack/webpack-dev-server/issues/641
function getPaths(publicPath, compiler, url) {
	var compilers = compiler && compiler.compilers;
	if(Array.isArray(compilers)) {
		var compilerPublicPath;
		for(var i = 0; i < compilers.length; i++) {
			compilerPublicPath = compilers[i].options
				&& compilers[i].options.output
				&& compilers[i].options.output.publicPath;
			if(url.indexOf(compilerPublicPath) === 0) {
				return {
					publicPath: compilerPublicPath,
					outputPath: compilers[i].outputPath
				};
			}
		}
	}
	return {
		publicPath: publicPath,
		outputPath: compiler.outputPath
	};
}

module.exports = function(publicPath, compiler, url) {
	var paths = getPaths(publicPath, compiler, url);
	return getFilenameFromUrl(paths.publicPath, paths.outputPath, url);
};
