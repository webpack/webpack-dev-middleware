'use strict';

const path = require('path');

module.exports = {
  mode: 'development',
  context: path.resolve(__dirname),
  entry: './foo.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, '../outputs/public-path'),
    publicPath: '/public/path/',
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
  infrastructureLogging: {
    level: 'none'
  },
  stats: 'errors-warnings'
};
