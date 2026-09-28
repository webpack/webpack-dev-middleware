const path = require("node:path");

/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("./index.js").Logger} Logger */
/** @typedef {import("./hot.js").HotOptions} HotOptions */

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
 * Whether a compiler produces something a browser will run, which is the whole
 * of what decides where the client goes.
 *
 * `platform` answers it for every target webpack resolves one from: `web` is
 * true for `web`, `webworker`, `electron-renderer`, `electron-preload`, `nwjs`,
 * `deno` and a browserslist query, and false for `node`, `async-node`,
 * `electron-main` and a `nodeXX` version. A target that names no platform at
 * all — `target: false`, or a bare `es2020` — leaves nothing to go on and gets
 * no client; add the entry yourself there.
 *
 * Two of webpack's `web` platforms are not pages and have no `window`, which
 * is the one thing the client's bootstrap needs, so they are left out.
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when the client belongs in this compilation
 */
function isWebTarget(compiler) {
  const { platform } = /** @type {EXPECTED_ANY} */ (compiler);

  // A worker has no `window`, and Deno removed it in 2.0 — the client's
  // bootstrap connects only where there is one, so either would carry a client
  // that never joins. Each is matched as itself: a universal target that
  // happens to include one of them reports `null` here and still runs in a
  // browser, so it keeps its client.
  // TODO let both back in once the client connects from `self` instead.
  if (platform.webworker === true || platform.deno === true) {
    return false;
  }

  // TODO remove the third clause once the `webpack` peer range starts at
  // ^5.108.0, which is where `platform.universal` was added. Until then a
  // universal target (`target: ["node", "web"]`) reports `universal:
  // undefined` and is recognized by `web` and `node` both being null — which
  // `target: false` also is, hence the guard for it.
  return Boolean(
    platform.web ||
    platform.universal ||
    (compiler.options.target !== false &&
      platform.web === null &&
      platform.node === null),
  );
}

// How the hot client is asked for by package name. Exact, because the package
// exports other things under `client/`.
const CLIENT_PACKAGE_REQUEST = "webpack-dev-middleware/client";

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
      // The hot client itself, with or without a query — not `./client/ws`,
      // `./client/overlay` or any other subpath this package exports. None of
      // those connects to anything, so finding one is not finding the client.
      request === CLIENT_PACKAGE_REQUEST ||
      request.startsWith(`${CLIENT_PACKAGE_REQUEST}?`) ||
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
 * @param {{ path: string, transport: NonNullable<HotOptions["transport"]>, inject?: boolean }} options resolved hot options
 * @param {Logger} logger logger
 */
function injectHotClient(compilers, options, logger) {
  if (options.inject === false) {
    return;
  }

  // A transport of your own carries whatever protocol you wrote it to carry,
  // and the built-in client speaks two. There is nothing to configure it with
  // here, so the client that speaks it is yours to add — the plugin below
  // still is not.
  let warned = false;

  // Written as one expression so the entry is built from a transport that is
  // known to name itself — a function has nothing to put in a query.
  const entry =
    typeof options.transport === "function"
      ? undefined
      : `${clientEntry()}?${new URLSearchParams({
          path: options.path,
          transport: options.transport,
        })}`;

  for (const compiler of compilers) {
    if (!isWebTarget(compiler)) {
      continue;
    }

    const { webpack } = compiler;

    if (!hasClientEntry(compiler)) {
      if (entry === undefined) {
        if (!warned) {
          warned = true;
          logger.warn(
            "'hot.transport' is a function, so no client was added: the built-in one speaks Server-Sent Events and WebSocket, not a transport of your own. Add an entry for the client that speaks it — 'HotModuleReplacementPlugin' is still applied for you, and 'hot.inject: false' silences this.",
          );
        }
      } else {
        new webpack.EntryPlugin(compiler.context, entry, {
          name: undefined,
        }).apply(compiler);
      }
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
