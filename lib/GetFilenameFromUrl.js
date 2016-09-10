var pathJoin = require("./PathJoin");

function getFilenameFromUrl(publicPath, outputPath, url) {
	// publicPrefix is the folder our bundle should be in
	var localPrefix = publicPath || "/";
	if(url.indexOf(localPrefix) !== 0) {
		if(/^(https?:)?\/\//.test(localPrefix)) {
			localPrefix = "/" + localPrefix.replace(/^(https?:)?\/\/[^\/]+\//, "");
			// fast exit if another directory requested
			if(url.indexOf(localPrefix) !== 0) return false;
		} else return false;
	}
	// get filename from request
	var filename = url.substr(localPrefix.length);
	if(filename.indexOf("?") >= 0) {
		filename = filename.substr(0, filename.indexOf("?"));
	}
	return filename ? pathJoin(outputPath, filename) : outputPath;
}

module.exports = getFilenameFromUrl;
