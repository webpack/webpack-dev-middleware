const path = require("node:path");

const MIN_BABEL_VERSION = 8;

// The middleware itself runs on the node.js version `engines` requires.
const NODE_TARGETS = { node: "20.9.0" };
// The hot client runs in the browser: it must stay parsable by an ES5 engine,
// so it is compiled down to ES5 (`ie: "11"` is preset-env's ES5 baseline).
// `modules: false` keeps the ESM syntax for webpack to tree-shake.
const CLIENT_TARGETS = { ie: "11" };

// The two webpack modules the client logs through, and the ES5 copies of them
// `scripts/build-client-logger.mjs` writes next to the built client.
const CLIENT_SRC = path.join(__dirname, "client-src");
const ES5_LOGGER = {
  "webpack/lib/logging/Logger.js": "Logger.cjs",
  "webpack/lib/logging/createConsoleLogger.js": "createConsoleLogger.cjs",
};

/**
 * Point the built client at the ES5 copies of webpack's logger. Webpack's own
 * are node-side source, which a bundle for an ES5 browser would carry as is.
 * @returns {import("@babel/core").PluginObj} plugin
 */
function useES5Logger() {
  return {
    name: "use-es5-logger",
    visitor: {
      ImportDeclaration(declaration, state) {
        const target = ES5_LOGGER[declaration.node.source.value];

        if (!target) {
          return;
        }

        const relative = path
          .relative(
            path.dirname(/** @type {string} */ (state.filename)),
            path.join(CLIENT_SRC, "modules", "logger", target),
          )
          .split(path.sep)
          .join("/");

        declaration.node.source.value = relative.startsWith(".")
          ? relative
          : `./${relative}`;
      },
    },
  };
}

module.exports = (api) => {
  api.assertVersion(MIN_BABEL_VERSION);

  // Jest transforms the sources too — there everything, the client included,
  // has to be CommonJS for the node.js running the tests.
  if (api.env("test")) {
    return {
      presets: [["@babel/preset-env", { targets: NODE_TARGETS }]],
    };
  }

  return {
    presets: [["@babel/preset-env", { targets: NODE_TARGETS }]],
    overrides: [
      {
        test: "./client-src",
        presets: [
          ["@babel/preset-env", { modules: false, targets: CLIENT_TARGETS }],
        ],
        plugins: [useES5Logger],
      },
    ],
  };
};
