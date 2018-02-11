'use strict';

module.exports = [{
  context: __dirname,
  entry: './foo.js',
  output: {
    filename: 'foo.js',
    path: '/client',
    publicPath: '/static/'
  }
}, {
  context: __dirname,
  entry: './bar.js',
  output: {
    filename: 'bar.js',
    path: '/server'
  }
}];
