'use strict';

const path = require('path');

module.exports = {
  mode: 'development',
  context: path.resolve(__dirname),
  entry: './broken.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, '../outputs/error'),
  },
  stats: 'errors-warnings'
};
