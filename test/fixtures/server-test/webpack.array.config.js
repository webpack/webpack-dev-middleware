'use strict';

module.exports = [{
  mode: 'development',
  context: __dirname,
  entry: './foo.js',
  output: {
    filename: 'foo.js',
    path: '/js1',
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
    path: '/js2',
    publicPath: '/js2/'
  }
}];
