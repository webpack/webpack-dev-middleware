'use strict';

const path = require('path');

module.exports = {
  mode: 'development',
  context: path.resolve(__dirname),
  entry: './broken.js',
  output: {
    path: path.resolve(__dirname, '../../outputs/'),
  },
  stats: 'errors-warnings'
};
