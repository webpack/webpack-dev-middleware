'use strict';

const webpack = require('webpack');

const middleware = require('../..');

const compiler = webpack({});

// eslint-disable-next-line no-console
console.info(middleware(compiler, {}).context.options);
