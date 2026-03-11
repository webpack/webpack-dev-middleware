#!/usr/bin/env node

const merge = require("deepmerge");
const express = require("express");
const webpack = require("webpack");

const middleware = require("../../dist");
const defaultConfig = require("../fixtures/webpack.config");

const configEntries = [];
const configMiddlewareEntries = [];

const isPlugin = process.argv.includes("--plugin");

/**
 * @param {string} NSKey NSKey
 * @param {string[]} accumulator accumulator
 */
function fillConfigEntries(NSKey, accumulator) {
  for (const key of Object.keys(process.env).filter(
    (key) => key.indexOf(NSKey) === 0,
  )) {
    let value = process.env[key];
    const keys = key.replace(NSKey, "").split("_");

    value = value === "true" ? true : value === "false" ? false : value;

    keys.push(value);
    accumulator.push(keys);
  }
}

fillConfigEntries("WCF_", configEntries);
fillConfigEntries("WMC_", configMiddlewareEntries);

/**
 * @param {string} name name
 * @returns {import("webpack").Configuration | import("webpack").Configuration[]} configuration
 */
function getWebpackConfig(name) {
  try {
    return require(`../fixtures/${name}`);
  } catch {
    return require("../fixtures/webpack.config");
  }
}

/**
 * @param {import("webpack").Configuration[]} data data
 * @returns {import("webpack").Configuration} configuration
 */
function createConfig(data) {
  /**
   * @param {string} entry entry
   * @returns {{ [string]: string }} object
   */
  function getObject(entry) {
    return { [entry[0]]: entry[1] };
  }

  /**
   * @param {import("webpack").Configuration[]} arr arr
   * @returns {import("webpack").Configuration} result
   */
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

let commands = [];
let incompleteCommand = "";

const handleStdin = (chunk) => {
  const entries = chunk.toString().split("|");

  incompleteCommand += entries.shift();
  commands.push(incompleteCommand);
  incompleteCommand = entries.pop();
  commands = [...commands, ...entries];

  while (commands.length > 0) {
    switch (commands.shift()) {
      // case 'invalidate':
      //   stdinInput = '';
      //   instance.waitUntilValid(() => {
      //     instance.invalidate();
      //   });
      //   break;
      case "exit":
        // eslint-disable-next-line n/no-process-exit
        process.exit();
        break;
    }
  }
};

/**
 * @param {import("webpack").StatsOptions} statsOptions stats options
 * @returns {{ preset: string }} normalized stats
 */
function normalizeStatsOptions(statsOptions) {
  if (typeof statsOptions === "undefined") {
    statsOptions = { preset: "normal" };
  } else if (typeof statsOptions === "boolean") {
    statsOptions = statsOptions ? { preset: "normal" } : { preset: "none" };
  } else if (typeof statsOptions === "string") {
    statsOptions = { preset: statsOptions };
  }

  return statsOptions;
}

if (isPlugin) {
  if (!config.plugins) config.plugins = [];

  config.plugins.push({
    apply(compiler) {
      let app;

      compiler.hooks.done.tap("webpack-dev-middleware-test", () => {
        const instance = middleware(compiler, configMiddleware, true);

        app = express();
        app.use(instance);
        app.listen((error) => {
          if (error) {
            throw error;
          }

          process.stdin.on("data", handleStdin);
        });
      });
    },
  });

  const compiler = webpack(config);

  compiler.watch({}, (err, stats) => {
    if (err) {
      throw err;
    }

    const statsOptions = normalizeStatsOptions(config.stats);

    if (typeof statsOptions.colors === "undefined") {
      statsOptions.colors = compiler.webpack.cli.isColorSupported();
    }

    process.stdout.write("compiled-for-tests");
    process.stdout.write(stats.toString(statsOptions));
  });
} else {
  const compiler = webpack(config);

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
  const instance = middleware(compiler, configMiddleware);
  const app = express();

  app.use(instance);
  app.listen((error) => {
    if (error) {
      throw error;
    }

    process.stdin.on("data", handleStdin);
  });
}
