'use strict';

const path = require('path');

module.exports = [
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './broken.js',
    output: {
      path: path.resolve(__dirname, 'js1'),
      publicPath: '/js1/',
    },
    infrastructureLogging: {
      level: 'none'
    },
    stats: 'errors-warnings'
  },
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './warning.js',
    output: {
      path: path.resolve(__dirname, 'js2'),
      publicPath: '/js2/',
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
    infrastructureLogging: {
      level: 'none'
    },
    stats: 'errors-warnings'
  },
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './foo.js',
    output: {
      path: path.resolve(__dirname, 'js3'),
      publicPath: '/js3/',
    },
    module: {
      rules: [
        {
          test: /\.(svg|html)$/,
          loader: 'file-loader',
          options: { name: '[name].[ext]' },
        },
      ],
    },
    infrastructureLogging: {
      level: 'none'
    },
    stats: 'errors-warnings'
  },
];
