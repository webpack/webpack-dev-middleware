module.exports = {
	mode: "development",
	devtool: false,
	context: __dirname,
	entry: "./foo.js",
	output: {
		filename: "bundle.js",
		path: "/"
	},
	module: {
		rules: [
			{
				test: /\.(svg|html)$/,
				loader: "file-loader",
				query: { name: "[name].[ext]" }
			}
		]
	}
};
