'use strict';

const path = require('path');

module.exports = [
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './foo.js',
    output: {
      filename: 'foo.js',
      path: path.resolve(__dirname, 'client'),
      publicPath: '/static/',
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
  },
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './bar.js',
    target: 'node',
    output: {
      filename: 'bar.js',
      path: path.resolve(__dirname, 'server'),
    },
    infrastructureLogging: {
      level: 'none'
    },
    stats: 'errors-warnings'
  },
];
