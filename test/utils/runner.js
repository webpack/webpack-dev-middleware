#!/usr/bin/env node

const express = require('express');
const webpack = require('webpack');
const merge = require('lodash.merge');

const middleware = require('../../dist').default;

const defaultConfig = require('../fixtures/webpack.config');

const configEntries = [];
const configMiddlewareEntries = [];

fillConfigEntries('WCF_', configEntries);
fillConfigEntries('WMC_', configMiddlewareEntries);

const config = createConfig(configEntries);
const unionConfig =
  Object.keys(config).length > 0
    ? merge({}, getWebpackConfig(process.env.WC), config)
    : getWebpackConfig(process.env.WC);
const configMiddleware = createConfig(configMiddlewareEntries);
const compiler = webpack(unionConfig || defaultConfig);
let instance;

if (process.env.WATCH_break) {
  compiler.watch = function watch() {
    const error = new Error('Watch error');
    error.code = 'watch error';

    throw error;
  };
}

try {
  instance = middleware(compiler, configMiddleware);
} catch (error) {
  // eslint-disable-next-line no-console
  console.log(error);
  process.exit(1);
}

const app = express();

try {
  app.use(instance);
} catch (error) {
  // eslint-disable-next-line no-console
  console.log(error);
  process.exit(1);
}

app.listen((error) => {
  if (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    process.exit(1);
  }

  let stdinInput = '';

  process.stdin.on('data', (chunk) => {
    stdinInput = chunk.toString();

    // eslint-disable-next-line default-case
    switch (stdinInput) {
      case 'invalidate':
        stdinInput = '';
        instance.waitUntilValid(() => {
          instance.invalidate();
        });
        break;
      case 'exit':
      case 'exitexit':
        stdinInput = '';
        process.exit(0);
        break;
      case 'error':
        stdinInput = '';
        process.exit(1);
        break;
    }
  });
});

function getWebpackConfig(name) {
  try {
    // eslint-disable-next-line global-require,import/no-dynamic-require
    return require(`../fixtures/${name}`);
  } catch (error) {
    // eslint-disable-next-line global-require
    return require(`../fixtures/webpack.config`);
  }
}

function createConfig(data) {
  function getObject(entry) {
    return { [entry[0]]: entry[1] };
  }

  function reduceObject(arr) {
    if (arr.length > 1) {
      const temp = [];
      temp.push(arr.pop());
      temp.push(arr.pop());

      return reduceObject([...arr, getObject(temp.reverse())]);
    }

    return arr[0];
  }

  const result = data.map((el) => reduceObject([...el]));

  return merge({}, ...result);
}

function fillConfigEntries(NSKey, accumulator) {
  Object.keys(process.env)
    .filter((key) => key.indexOf(NSKey) === 0)
    .forEach((key) => {
      let value = process.env[key];
      const keys = key.replace(NSKey, '').split('_');

      value = value === 'true' ? true : value === 'false' ? false : value;

      keys.push(value);
      accumulator.push(keys);
    });
}
