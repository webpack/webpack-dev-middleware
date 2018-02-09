'use strict';

module.exports = {
  context: __dirname,
  entry: './foo.js',
  output: {
    filename: 'bundle.js',
    path: '/'
  },
  module: {
    loaders: [
      {
        test: /\.(svg|html)$/,
        loader: 'file-loader',
        query: { name: '[name].[ext]' }
      },
      {
        test: /htmlnoext/,
        loader: 'file-loader',
        query: { name: 'htmlnoext' }
      }
    ]
  }
};
