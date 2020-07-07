'use strict';

const path = require('path');

module.exports = {
  mode: 'development',
  context: path.resolve(__dirname),
  entry: './simple.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, '../outputs/public-path'),
    publicPath: '/public/path/',
  },
  infrastructureLogging: {
    level: 'none'
  },
  stats: 'errors-warnings'
};
