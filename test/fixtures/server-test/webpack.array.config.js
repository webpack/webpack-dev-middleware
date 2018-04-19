'use strict';

const path = require('path');

module.exports = [{
  mode: 'development',
  context: __dirname,
  entry: './foo.js',
  output: {
    filename: 'foo.js',
    path: path.resolve(__dirname, 'js1'),
    publicPath: '/js1/'
  },
  module: {
    rules: [
      {
        test: /\.(svg|html)$/,
        loader: 'file-loader',
        query: { name: '[name].[ext]' }
      }
    ]
  }
}, {
  mode: 'development',
  context: __dirname,
  entry: './bar.js',
  output: {
    filename: 'bar.js',
    path: path.resolve(__dirname, 'js2'),
    publicPath: '/js2/'
  }
}];
