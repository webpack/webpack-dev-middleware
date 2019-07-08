'use strict';

const path = require('path');

const execa = require('execa');

const webpackDevServerMiddlewarePath = path.resolve(
  __dirname,
  './log-middleware-options.js'
);

function testBin(testArgs) {
  const cwd = process.cwd();
  const env = process.env.NODE_ENV;

  if (!testArgs) {
    // eslint-disable-next-line no-param-reassign
    testArgs = [];
  } else if (typeof testArgs === 'string') {
    // eslint-disable-next-line no-param-reassign
    testArgs = testArgs.split(' ');
  }

  const args = [webpackDevServerMiddlewarePath].concat(testArgs);

  return execa('node', args, { cwd, env, timeout: 10000 });
}

module.exports = testBin;
