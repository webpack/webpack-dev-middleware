'use strict';

const path = require('path');

module.exports = [
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './warning.js',
    output: {
      path: path.resolve(__dirname, '../../outputs/'),
    },
    plugins: [
      {
        apply(compiler) {
          compiler.hooks.emit.tapAsync('WarningPlugin', (compilation, done) => {
            compilation.warnings.push(new Error('Warning'));

            done();
          })
        },
      }
    ],
    stats: 'errors-warnings'
  },
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './warning.js',
    output: {
      path: path.resolve(__dirname, '../../outputs/'),
    },
    plugins: [
      {
        apply(compiler) {
          compiler.hooks.emit.tapAsync('WarningPlugin', (compilation, done) => {
            compilation.warnings.push(new Error('Warning'));

            done();
          })
        },
      }
    ],
    stats: 'errors-warnings'
  },
];
