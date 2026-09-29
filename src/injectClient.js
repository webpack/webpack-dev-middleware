const path = require("node:path");

/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("./index.js").Logger} Logger */
/** @typedef {import("./hot.js").HotOptions} HotOptions */
/** @typedef {import("./hot.js").HotClientOptions} HotClientOptions */

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
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when the client belongs in this compilation
 */
function isWebTarget(compiler) {
  const { platform } = /** @type {EXPECTED_ANY} */ (compiler);

  // Deno has no `window`, and whether it has the transports is not something
  // this suite can answer. Matched as itself: a universal target that includes
  // it reports `null` here and still runs in a browser.
  // TODO include Deno once it can be tested there.
  if (platform.deno === true) {
    return false;
  }

  // A universal target (`target: ["node", "web"]`) is `null` for both, which
  // `target: false` also is — hence the guard for it.
  // TODO drop the third clause once the `webpack` peer range starts at
  // ^5.108.0, which added `platform.universal`.
  return Boolean(
    platform.web ||
    platform.universal ||
    (compiler.options.target !== false &&
      platform.web === null &&
      platform.node === null),
  );
}

// How the hot client is asked for by package name. Exact, because the package
// exports other things under `client/` — `client/ws`, `client/overlay` — and
// none of those connects to anything.
const CLIENT_PACKAGE_REQUEST = "webpack-dev-middleware/client";

// The same file asked for by path: as published, and as it is in this
// repository, which is how its own tests reach it.
const CLIENT_FILES = [
  path.join(__dirname, "..", "client", "index.js"),
  path.join(__dirname, "..", "client-src", "index.js"),
];

/**
 * Whether one entry request is this package's client.
 * @param {string} request an entry request
 * @param {string} context the compilation's context, which relative requests are resolved against
 * @returns {boolean} true when the request is the client
 */
function isClientRequest(request, context) {
  // A query belongs to the client, not to which file it is.
  const [resource] = request.split("?");

  if (resource === CLIENT_PACKAGE_REQUEST) {
    return true;
  }

  // Resolved and compared as a path rather than by how it ends: a project's
  // own `./src/client/index.js` is a common application entry and has nothing
  // to do with this package.
  return CLIENT_FILES.includes(path.resolve(context, resource));
}

/**
 * Which of a compilation's entry points do not pull the client in.
 *
 * Per entry point, because they are separate pages: a build with `landing` and
 * `dashboard` where only `landing` has the client still needs one in
 * `dashboard`, or that page connects to nothing.
 *
 * Best effort by design: `entry` can be a function, and a request can reach the
 * client through an alias or a loader. Missing one of those costs a duplicate
 * entry, not a broken build, and `hot.inject: false` is the way out.
 * @param {Compiler} compiler compiler
 * @returns {string[] | null} the names that need one, or null when they all do
 */
function entriesMissingClient(compiler) {
  const { entry } = compiler.options;

  // Computed per build, so there is nothing to read here.
  if (typeof entry === "function") {
    return null;
  }

  const names = Object.keys(entry || {});
  const missing = names.filter((name) => {
    const imported = /** @type {EXPECTED_ANY} */ (entry)[name].import;
    const requests =
      typeof imported === "string"
        ? [imported]
        : Array.isArray(imported)
          ? imported
          : [];

    return !requests.some(
      (request) =>
        typeof request === "string" &&
        isClientRequest(request, compiler.context),
    );
  });

  // All of them, so one entry that every entry point gets — the same single
  // entry this added before it could tell them apart.
  return missing.length === names.length ? null : missing;
}

/**
 * Whether every entry point already pulls the client in.
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when nothing needs adding
 */
function hasClientEntry(compiler) {
  const missing = entriesMissingClient(compiler);

  return missing !== null && missing.length === 0;
}

// Which `client` values the overlay reads as a filter rather than a flag. A
// function cannot travel as JSON, so it goes as its source and the client
// rebuilds it — the same encoding webpack-dev-server has always used.
const OVERLAY_FILTERS = ["errors", "warnings", "runtimeErrors"];

/**
 * Whether source can stand where the client puts it — after `var callback =`.
 * Compiled rather than run: nothing in it is executed here.
 * @param {string} source a function's source
 * @returns {boolean} true when it is an expression
 */
function isExpression(source) {
  try {
    // eslint-disable-next-line no-new-func
    const compiled = new Function(`var callback = ${source}`);

    return typeof compiled === "function";
  } catch {
    return false;
  }
}

/**
 * A filter as source the client can rebuild from.
 *
 * An arrow function and a `function` both stringify to something that can be
 * assigned; a method shorthand — `overlay: { errors(message) {} }` — does not,
 * and would have gone over as `errors(message) {}` for the client to choke on.
 * Making it a function expression is the whole of the difference.
 * @param {string} option which filter it is, for the error
 * @param {EXPECTED_ANY} filter the function given
 * @returns {string} source the client can assign
 */
function filterSource(option, filter) {
  const source = filter.toString();

  if (isExpression(source)) {
    return source;
  }

  if (isExpression(`function ${source}`)) {
    return `function ${source}`;
  }

  // Said here rather than left for the browser: this is a configuration
  // mistake, and the stack in a page would point at the client instead.
  throw new Error(
    `The 'hot.client.overlay.${option}' function could not be serialized for the browser. Write it as a function expression or an arrow function.`,
  );
}

/**
 * The browser options, as the client reads them from its resource query.
 * @param {EXPECTED_ANY} client the `hot.client` option
 * @returns {Record<string, string>} query parameters
 */
function clientQuery(client) {
  /** @type {Record<string, string>} */
  const query = {};

  if (!client) {
    return query;
  }

  for (const [key, value] of Object.entries(client)) {
    if (typeof value === "undefined") {
      continue;
    }

    if (key !== "overlay") {
      query[key] = String(value);
      continue;
    }

    if (typeof value !== "object" || value === null) {
      query.overlay = String(value);
      continue;
    }

    /** @type {Record<string, EXPECTED_ANY>} */
    const overlay = {};

    for (const [option, setting] of Object.entries(value)) {
      overlay[option] =
        OVERLAY_FILTERS.includes(option) && typeof setting === "function"
          ? encodeURIComponent(filterSource(option, setting))
          : setting;
    }

    query.overlay = JSON.stringify(overlay);
  }

  return query;
}

/**
 * Put the hot runtime into the compilation, so enabling `hot` is the whole of
 * what a developer has to do: no entry to add, no `HotModuleReplacementPlugin`
 * to remember, no configuration to change.
 *
 * The client is given the endpoint, the transport and the browser options
 * through its resource query, so it agrees with the server by construction
 * rather than by the developer keeping two settings in step.
 * @param {Compiler[]} compilers compilers to modify
 * @param {{ path: string, transport: NonNullable<HotOptions["transport"]>, inject?: boolean, client?: HotClientOptions }} options resolved hot options
 * @param {Logger} logger logger
 */
function injectHotClient(compilers, options, logger) {
  if (options.inject === false) {
    return;
  }

  let warned = false;

  // What the developer set in node, which wins over everything below it: these
  // are the same options the query carries, so either spelling reaches the
  // runtime and the one written by hand is the one that counts.
  const client = clientQuery(options.client);

  // A transport of your own carries whatever protocol you wrote it to carry,
  // and the built-in client speaks two. When yours speaks one of them,
  // `hot.client.transport` says which and the client is added as usual;
  // without that there is nothing to point it at, so the client is yours to
  // add — the plugin below still is not.
  /** @type {string | undefined} */
  const transport =
    typeof options.transport === "function"
      ? client.transport
      : options.transport;

  // Overriding the transport is for a client that talks to something else, so
  // it comes with an endpoint of its own. Without one it is pointed straight
  // back at this middleware speaking the wrong protocol, which is a page that
  // silently never connects.
  if (
    typeof options.transport === "string" &&
    client.transport &&
    client.transport !== options.transport &&
    !client.path
  ) {
    logger.warn(
      `'hot.client.transport' is '${client.transport}' while the endpoint serves '${options.transport}', so the client will not connect. Set them to the same thing, or give 'hot.client.path' the endpoint that does speak '${client.transport}'.`,
    );
  }

  for (const compiler of compilers) {
    if (!isWebTarget(compiler)) {
      continue;
    }

    const { webpack } = compiler;

    const missing = entriesMissingClient(compiler);

    if (missing === null || missing.length > 0) {
      if (transport === undefined) {
        if (!warned) {
          warned = true;
          logger.warn(
            "'hot.transport' is a function, so no client was added: the built-in one speaks Server-Sent Events and WebSocket, not a transport of your own. Set 'hot.client.transport' if yours speaks one of them, or add an entry for the client that speaks it — 'HotModuleReplacementPlugin' is still applied for you, and 'hot.inject: false' silences this.",
          );
        }
      } else {
        // The endpoint and the transport the middleware resolved, and the
        // compilation's name so each bundle's client reports only its own
        // builds — without that a page shows an overlay for a build error in
        // code it does not contain. All three are defaults: `hot.client`
        // carries the same options and is spread over them.
        const { name: compilation } = compiler.options;
        /** @type {Record<string, string>} */
        const query = { path: options.path, transport };

        if (compilation) {
          query.name = compilation;
        }

        const search = new URLSearchParams({ ...query, ...client }).toString();
        const entry = `${clientEntry()}?${search}`;

        if (missing === null) {
          // No entry point has one, so a single entry every one of them gets.
          new webpack.EntryPlugin(compiler.context, entry, {
            name: undefined,
          }).apply(compiler);
        } else {
          // Some already have it. Adding a global entry would give those a
          // second copy, so the ones without it are named instead.
          for (const entryPoint of missing) {
            new webpack.EntryPlugin(compiler.context, entry, {
              name: entryPoint,
            }).apply(compiler);
          }
        }
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
module.exports.clientQuery = clientQuery;
module.exports.filterSource = filterSource;
module.exports.hasClientEntry = hasClientEntry;
module.exports.isWebTarget = isWebTarget;
