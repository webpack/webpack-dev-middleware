module.exports = {
	context: __dirname,
	entry: "./foo.js",
	output: {
		filename: "bundle.js",
		path: "/"
	},
	module: {
		loaders: [
			{
				test: /\.(svg|html)$/,
				loader: "file",
				query: { name: "[name].[ext]" }
			}
		]
	}
};
