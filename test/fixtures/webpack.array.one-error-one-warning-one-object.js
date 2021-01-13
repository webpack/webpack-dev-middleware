'use strict';

const path = require('path');

module.exports = [
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './broken.js',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, '../outputs/one-error-one-warning-one-success/js1'),
      publicPath: '/static-one/',
    },
    infrastructureLogging: {
      level: 'none'
    },
    stats: 'normal'
  },
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './warning.js',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, '../outputs/one-error-one-warning-one-success/js2'),
      publicPath: '/static-two/',
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
    stats: 'normal'
  },
  {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: './foo.js',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'js3'),
      publicPath: '/static-three/',
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
    stats: {
      all: false,
      assets: true,
    }
  },
];
