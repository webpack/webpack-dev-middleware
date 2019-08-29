'use strict';

module.exports = {
  mode: 'development',
  context: __dirname,
  entry: './foo.js',
  output: {
    filename: 'bundle.js',
    path: '/',
  },
  module: {
    rules: [
      {
        test: /\.(svg|html)$/,
        loader: 'file-loader',
        options: { name: '[name].[ext]' },
      },
    ],
  },
};
