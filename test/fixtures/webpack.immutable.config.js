'use strict';

const path = require('path');

module.exports = {
  mode: 'development',
  context: path.resolve(__dirname),
  entry: './immutable.js',
  output: {
    publicPath: "/static/",
    path: path.resolve(__dirname, '../outputs/basic'),
  },
  infrastructureLogging: {
    level: 'none'
  },
  stats: 'normal'
};
