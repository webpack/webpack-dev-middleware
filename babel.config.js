const MIN_BABEL_VERSION = 7;

// The middleware itself runs on the node.js version `engines` requires.
const NODE_TARGETS = { node: "20.9.0" };
// The hot client runs in the browser: it must stay parsable by an ES5 engine,
// so it is compiled down to ES5 (`ie: "11"` is preset-env's ES5 baseline).
// `modules: false` keeps the ESM syntax for webpack to tree-shake.
const CLIENT_TARGETS = { ie: "11" };

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
      },
    ],
  };
};
