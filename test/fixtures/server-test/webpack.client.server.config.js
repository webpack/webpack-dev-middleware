'use strict';

module.exports = [{
  mode: 'development',
  context: __dirname,
  entry: './foo.js',
  output: {
    filename: 'foo.js',
    path: '/client',
    publicPath: '/static/'
  }
}, {
  mode: 'development',
  context: __dirname,
  entry: './bar.js',
  output: {
    filename: 'bar.js',
    path: '/server'
  }
}];
