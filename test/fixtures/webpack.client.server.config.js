'use strict';

const path = require('path');

module.exports = [
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './foo.js',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, '../outputs/client-server/client'),
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
      filename: 'bundle.js',
      path: path.resolve(__dirname, '../outputs/client-server/server'),
    },
    infrastructureLogging: {
      level: 'none'
    },
    stats: 'errors-warnings'
  },
];
