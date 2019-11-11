'use strict';

const path = require('path');

module.exports = {
  mode: 'development',
  context: __dirname,
  entry: './foo.js',
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
};
