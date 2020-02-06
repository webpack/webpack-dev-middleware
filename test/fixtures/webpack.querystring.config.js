'use strict';

const path = require('path');

module.exports = {
  mode: 'development',
  context: path.resolve(__dirname),
  entry: './foo.js',
  output: {
    filename: 'bundle.js?[contenthash]',
    path: path.resolve(__dirname, '../outputs/querystring'),
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
