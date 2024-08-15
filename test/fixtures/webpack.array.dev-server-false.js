'use strict';

const path = require('path');

module.exports = [
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './bar.js',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, '../outputs/array/js3'),
      publicPath: '/static-two/',
    },
    infrastructureLogging: {
      level: 'none'
    },
    stats: 'normal',
    devServer: false,
  },
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './foo.js',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, '../outputs/array/js4'),
      publicPath: '/static-one/',
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
    stats: 'normal'
  }
];
