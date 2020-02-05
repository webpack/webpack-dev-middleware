'use strict';

const path = require('path');

module.exports = {
  mode: 'development',
  context: path.resolve(__dirname),
  entry: './warning.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, '../outputs/warning'),
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
};
