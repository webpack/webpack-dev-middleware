'use strict';

const path = require('path');

module.exports = {
  mode: 'development',
  context: __dirname,
  entry: './foo.js',
  output: {
    path: path.resolve(__dirname, '../../outputs/'),
  }
};
