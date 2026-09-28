const path = require("node:path");

/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("./index.js").Logger} Logger */

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/**
 * The browser runtime, as it is published. Resolved when it is needed rather
 * than at load, so requiring this module in a checkout that has not been built
 * does not throw.
 * @returns {string} absolute path to the client entry
 */
function clientEntry() {
  return path.join(__dirname, "..", "client", "index.js");
}

/**
 * Whether a compiler produces something a browser will run. A `web` or
 * universal target gets the client; `target: false` is `null` everywhere, so it
 * is excluded rather than treated as universal.
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when the client belongs in this compilation
 */
function isWebTarget(compiler) {
  const { platform } = /** @type {EXPECTED_ANY} */ (compiler);

  // webpack before 5.96 has no `platform`; there `target` is all there is.
  if (!platform) {
    const { target } = compiler.options;

    if (target === false) {
      return false;
    }

    if (typeof target === "undefined") {
      return true;
    }

    const targets = Array.isArray(target) ? target : [target];

    return targets.some(
      (item) => typeof item === "string" && item.includes("web"),
    );
  }

  return Boolean(
    platform.web ||
    platform.universal ||
    (compiler.options.target !== false &&
      platform.web === null &&
      platform.node === null),
  );
}

/**
 * Whether this compilation already pulls the client in. Anyone who followed the
 * documentation before it was injected for them has it in `entry`, and a second
 * copy is at best wasted bytes.
 *
 * Best effort by design: `entry` can be a function, and a request can reach the
 * client through an alias or a loader. Missing one of those costs a duplicate
 * entry, not a broken build, and `hot.inject: false` is the way out.
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when the client is already an entry
 */
function hasClientEntry(compiler) {
  const { entry } = compiler.options;

  if (typeof entry === "function") {
    return false;
  }

  /** @type {string[]} */
  const requests = [];

  for (const value of Object.values(entry || {})) {
    const imported = /** @type {EXPECTED_ANY} */ (value).import;

    if (typeof imported === "string") {
      requests.push(imported);
    } else if (Array.isArray(imported)) {
      requests.push(...imported.filter((item) => typeof item === "string"));
    }
  }

  return requests.some(
    (request) =>
      request.startsWith("webpack-dev-middleware/client") ||
      request.includes(`${path.sep}client${path.sep}index.js`) ||
      request.includes(`${path.sep}client-src${path.sep}index.js`),
  );
}

/**
 * Put the hot runtime into the compilation, so enabling `hot` is the whole of
 * what a developer has to do: no entry to add, no `HotModuleReplacementPlugin`
 * to remember, no configuration to change.
 *
 * The client is given the endpoint and the transport through its resource
 * query, so it agrees with the server by construction rather than by the
 * developer keeping two settings in step.
 * @param {Compiler[]} compilers compilers to modify
 * @param {{ path: string, transport: string, inject?: boolean }} options resolved hot options
 * @param {Logger} logger logger
 */
function injectHotClient(compilers, options, logger) {
  if (options.inject === false) {
    return;
  }

  const query = new URLSearchParams({
    path: options.path,
    transport: options.transport,
  });
  const entry = `${clientEntry()}?${query}`;

  for (const compiler of compilers) {
    if (!isWebTarget(compiler)) {
      continue;
    }

    const { webpack } = compiler;

    if (!hasClientEntry(compiler)) {
      new webpack.EntryPlugin(compiler.context, entry, {
        name: undefined,
      }).apply(compiler);
    }

    const hmrPluginExists = compiler.options.plugins.some(
      (plugin) =>
        plugin && plugin.constructor === webpack.HotModuleReplacementPlugin,
    );

    if (hmrPluginExists) {
      logger.warn(
        "'hot' applies HotModuleReplacementPlugin for you — it does not need to be in the webpack configuration as well.",
      );
    } else {
      new webpack.HotModuleReplacementPlugin().apply(compiler);
    }
  }
}

module.exports = injectHotClient;
module.exports.hasClientEntry = hasClientEntry;
module.exports.isWebTarget = isWebTarget;
