'use strict';

const path = require('path');

module.exports = [
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './broken.js',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, '../outputs/array-error'),
      publicPath: '/static-one/',
    },
    stats: 'errors-warnings'
  },
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './broken.js',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, '../outputs/array-error'),
      publicPath: '/static-two/',
    },
    stats: 'errors-warnings'
  }
];
