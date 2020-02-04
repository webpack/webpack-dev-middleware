'use strict';

const path = require('path');

module.exports = {
  mode: 'development',
  context: __dirname,
  entry: './simple.js',
  output: {
    path: path.resolve(__dirname, '../../outputs/'),
  },
  stats: 'errors-warnings'
};
