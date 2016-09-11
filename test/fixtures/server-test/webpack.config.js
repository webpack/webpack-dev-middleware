module.exports = {
	quiet: true,
	context: __dirname,
	entry: "./index.js",
	output: {
		filename: "bundle.js",
		path: "/"
	},
	module: {
		loaders: [
			{
				test: /\.svg$/,
				loader: "file",
				query: { name: "[name].[ext]" }
			}
		]
	}
};
