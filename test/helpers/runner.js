#!/usr/bin/env node

const express = require("express");
const webpack = require("webpack");
const merge = require("deepmerge");

const middleware = require("../../dist");
const defaultConfig = require("../fixtures/webpack.config");

const configEntries = [];
const configMiddlewareEntries = [];

fillConfigEntries("WCF_", configEntries);
fillConfigEntries("WMC_", configMiddlewareEntries);

const createdConfig = createConfig(configEntries);
const unionConfig =
  Object.keys(createdConfig).length > 0
    ? merge(getWebpackConfig(process.env.WEBPACK_CONFIG), createdConfig)
    : getWebpackConfig(process.env.WEBPACK_CONFIG);
const configMiddleware = createConfig(configMiddlewareEntries);
const config = unionConfig || defaultConfig;

if (Array.isArray(config)) {
  config.parallelism = 1;
}

const compiler = webpack(config);

let instance;

if (process.env.WEBPACK_BREAK_WATCH) {
  compiler.watch = function watch() {
    const error = new Error("Watch error");
    error.code = "watch error";

    throw error;
  };
}

compiler.hooks.done.tap("plugin-test", () => {
  process.stdout.write("compiled-for-tests");
});

switch (process.env.WEBPACK_DEV_MIDDLEWARE_STATS) {
  case "object":
    configMiddleware.stats = { all: false, assets: true };
    break;
  case "object_colors_true":
    configMiddleware.stats = { all: false, assets: true, colors: true };
    break;
  case "object_colors_false":
    configMiddleware.stats = { all: false, assets: true, colors: false };
    break;
  default:
  // Nothing
}

try {
  instance = middleware(compiler, configMiddleware);
} catch (error) {
  throw error;
}

const app = express();

try {
  app.use(instance);
} catch (error) {
  throw error;
}

app.listen((error) => {
  if (error) {
    throw error;
  }

  let commands = [];
  let incompleteCommand = "";

  process.stdin.on("data", (chunk) => {
    const entries = chunk.toString().split("|");

    incompleteCommand += entries.shift();
    commands.push(incompleteCommand);
    incompleteCommand = entries.pop();
    commands = commands.concat(entries);

    while (commands.length > 0) {
      // eslint-disable-next-line default-case
      switch (commands.shift()) {
        // case 'invalidate':
        //   stdinInput = '';
        //   instance.waitUntilValid(() => {
        //     instance.invalidate();
        //   });
        //   break;
        case "exit":
          process.exit();
          break;
      }
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

  return merge.all(result);
}

function fillConfigEntries(NSKey, accumulator) {
  Object.keys(process.env)
    .filter((key) => key.indexOf(NSKey) === 0)
    .forEach((key) => {
      let value = process.env[key];
      const keys = key.replace(NSKey, "").split("_");

      value = value === "true" ? true : value === "false" ? false : value;

      keys.push(value);
      accumulator.push(keys);
    });
}
