const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const express = require("express");
const webpack = require("webpack");

const middleware = require("../../src");

const CLIENT_ENTRY = require.resolve("../../client-src/index.js");
const CLIENT_SRC = path.join(__dirname, "..", "..", "client-src");
const COLLECT_COVERAGE = Boolean(process.env.E2E_COVERAGE);

/**
 * Instrument the hot client as webpack bundles it, so the browser reports
 * what these tests actually exercised. Only the client: the fixture apps are
 * throwaway code.
 * @returns {EXPECTED_ANY} a webpack module rule
 */
function clientCoverageRule() {
  return {
    test: /\.js$/,
    include: CLIENT_SRC,
    use: {
      loader: require.resolve("babel-loader"),
      options: {
        babelrc: false,
        configFile: false,
        plugins: [
          [
            require.resolve("babel-plugin-istanbul"),
            {
              cwd: CLIENT_SRC,
              // Reach the global directly. The default finds it with
              // `new Function("return this")`, which a page enforcing
              // `require-trusted-types-for 'script'` refuses to compile —
              // instrumenting must not change what the client can run under.
              coverageGlobalScope: "globalThis",
              coverageGlobalScopeFunc: false,
            },
          ],
        ],
      },
    },
  };
}

/**
 * @param {string[]} scripts script sources
 * @returns {string} page html
 */
function pageHtml(scripts) {
  const tags = scripts.map((src) => `<script src="${src}"></script>`).join("");

  return `<!DOCTYPE html><html><head><title>wdm e2e</title></head><body><div id="app"></div>${tags}</body></html>`;
}

/**
 * @param {string} name compilation name ("" for the single-compiler mode)
 * @param {string} dir fixture directory
 * @param {string} appFile entry file
 * @param {string} query extra client query ("?..." or "")
 * @param {string=} publicPath output public path
 * @param {boolean=} hmrPlugin include HotModuleReplacementPlugin
 * @returns {EXPECTED_ANY} webpack configuration
 */
function makeConfig(
  name,
  dir,
  appFile,
  query,
  publicPath = "/",
  hmrPlugin = true,
) {
  const clientQuery = name
    ? `?name=${name}${query ? `&${query.replace(/^\?/, "")}` : ""}`
    : query;

  return {
    ...(name ? { name } : {}),
    mode: "development",
    context: dir,
    entry: [`${CLIENT_ENTRY}${clientQuery}`, appFile],
    output: {
      path: path.join(dir, "dist"),
      filename: name ? `${name}.js` : "main.js",
      publicPath,
      // Both compilations share a context dir; without distinct uniqueNames
      // their runtimes would fight over the same global hot-update callback
      // and updates would fail with ChunkLoadError.
      ...(name ? { uniqueName: name } : {}),
    },
    ...(COLLECT_COVERAGE ? { module: { rules: [clientCoverageRule()] } } : {}),
    plugins: hmrPlugin ? [new webpack.HotModuleReplacementPlugin()] : [],
    infrastructureLogging: { level: "none" },
    stats: "none",
    devtool: false,
    // Polling keeps rebuild detection deterministic across filesystems.
    watchOptions: { aggregateTimeout: 50, poll: 100 },
  };
}

/**
 * Spin up a real HMR app for the browser e2e tests: a webpack compiler in
 * watch mode over a temporary source directory, served by the middleware with
 * the `hot` option through express. Rebuilds are triggered by editing the
 * fixtures with `edit()`.
 *
 * Single-compiler mode: pass `code` (entry app.js) and optionally `query`
 * (appended to the client entry) and `files` (extra fixture files by relative
 * name). Multi-compiler mode: pass `apps: [{ name, code }]` instead — each
 * app becomes a named compilation whose client connects with `?name=<name>`
 * and renders from `<name>.js`. `pageHeaders` are sent with the HTML page
 * (e.g. a Content-Security-Policy).
 * Pass `transport: "ws"` to serve the events over a WebSocket instead of
 * Server-Sent Events: the middleware is told to, the client is asked for the
 * matching transport, and the HTTP server is handed over so it can answer the
 * upgrade.
 * @param {{ query?: string, code?: string, files?: Record<string, string>, apps?: { name: string, code: string }[], hot?: EXPECTED_ANY, stats?: EXPECTED_ANY, pageHeaders?: Record<string, string>, publicPath?: string, setup?: (server: EXPECTED_ANY) => void, hmrPlugin?: boolean, transport?: ("sse" | "ws") }} options options
 * @returns {Promise<EXPECTED_ANY>} handles for the running app
 */
async function createHotApp({
  query = "",
  code,
  files = {},
  apps,
  hot = true,
  stats,
  pageHeaders = {},
  publicPath = "/",
  setup,
  hmrPlugin = true,
  transport = "sse",
}) {
  const dir = fs.mkdtempSync(
    path.join(fs.realpathSync.native(os.tmpdir()), "wdm-e2e-"),
  );

  /** @type {EXPECTED_ANY} */
  let instance;
  /** @type {EXPECTED_ANY} */
  let server;

  const removeDir = () => {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
  };

  try {
    for (const [relative, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, relative), content);
    }

    /** @type {Record<string, string>} entry file per app name */
    const entryFiles = {};
    /** @type {EXPECTED_ANY} */
    let config;
    /** @type {string[]} */
    let scripts;

    // The client picks its transport from its own query, so it has to be told
    // the same thing the middleware was.
    const clientQuery =
      transport === "ws"
        ? `?transport=ws${query ? `&${query.replace(/^\?/, "")}` : ""}`
        : query;

    if (apps) {
      config = apps.map((app) => {
        // One context dir per compilation: editing one app's entry must not
        // invalidate the sibling compiler through the shared directory, or
        // the order of the two `building` events becomes nondeterministic.
        const appDir = path.join(dir, app.name);
        fs.mkdirSync(appDir, { recursive: true });
        entryFiles[app.name] = path.join(appDir, "entry.js");
        fs.writeFileSync(entryFiles[app.name], app.code);
        return makeConfig(app.name, appDir, entryFiles[app.name], clientQuery);
      });
      scripts = apps.map((app) => `/${app.name}.js`);
    } else {
      entryFiles[""] = path.join(dir, "app.js");
      fs.writeFileSync(entryFiles[""], /** @type {string} */ (code));
      config = makeConfig(
        "",
        dir,
        entryFiles[""],
        clientQuery,
        publicPath,
        hmrPlugin,
      );
      scripts = [`${publicPath}main.js`];
    }

    const compiler = webpack(config);

    /** @type {((stats: EXPECTED_ANY) => void)[]} */
    const buildWaiters = [];

    compiler.hooks.done.tap("wdm-e2e", (stats) => {
      for (const waiter of buildWaiters.splice(0)) {
        waiter(stats);
      }
    });

    instance = middleware(compiler, {
      hot:
        transport === "ws" && hot
          ? { ...(hot === true ? {} : hot), transport: "ws" }
          : hot,
      stats,
    });

    const app = express();

    app.get("/", (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      for (const [name, value] of Object.entries(pageHeaders)) {
        res.setHeader(name, value);
      }
      res.end(pageHtml(scripts));
    });
    if (setup) {
      // Extra routes (e.g. an open-editor endpoint) mount before the
      // middleware.
      setup(app);
    }
    app.use(instance);

    /**
     * @param {number} port port to bind (0 for ephemeral)
     * @param {number} attempts retries left for EADDRINUSE races
     * @returns {Promise<EXPECTED_ANY>} listening server
     */
    const listen = (port, attempts = 10) =>
      new Promise((resolve, reject) => {
        const created = app.listen(port);
        created.once("listening", () => resolve(created));
        created.once("error", (error) => {
          if (error.code === "EADDRINUSE" && attempts > 0) {
            setTimeout(() => {
              listen(port, attempts - 1).then(resolve, reject);
            }, 100);
          } else {
            reject(error);
          }
        });
      });

    /** @type {EXPECTED_ANY[]} */
    let upgradedSockets = [];

    /**
     * A WebSocket handshake is an upgrade the HTTP server answers, which the
     * middleware never sees — so it only works once the server is handed over.
     * Every server this app listens on needs that again, the replacement one a
     * restart brings up included.
     * @param {EXPECTED_ANY} httpServer the server now serving this app
     */
    const attachTransport = (httpServer) => {
      if (transport !== "ws") {
        return;
      }

      instance.attach(httpServer);
      // Once a socket is upgraded it stops being the HTTP server's to close,
      // so `closeAllConnections()` does not reach it and a shutdown would
      // wait on a connected client forever. Tracked here to be severed by
      // hand, which is also what a client sees when a server really dies.
      httpServer.on("upgrade", (/** @type {EXPECTED_ANY} */ _req, socket) => {
        upgradedSockets.push(socket);
      });
    };

    /** Sever every upgraded connection this app is holding open. */
    const severUpgraded = () => {
      for (const socket of upgradedSockets) {
        socket.destroy();
      }

      upgradedSockets = [];
    };

    server = await listen(0);
    attachTransport(server);

    const { port } = server.address();

    await new Promise((resolve) => {
      instance.waitUntilValid(resolve);
    });

    return {
      url: `http://127.0.0.1:${port}/`,
      port,
      instance,
      dir,

      /**
       * Rewrite an app source; the watcher picks it up and rebuilds. In
       * multi-compiler mode the first argument is the app name.
       * @param {string} nameOrSource app name (multi) or source (single)
       * @param {string=} maybeSource source when a name was given
       */
      edit(nameOrSource, maybeSource) {
        if (maybeSource === undefined) {
          fs.writeFileSync(entryFiles[""], nameOrSource);
        } else {
          fs.writeFileSync(entryFiles[nameOrSource], maybeSource);
        }
      },

      /**
       * Rewrite an extra fixture file (from `files`).
       * @param {string} relative file name relative to the fixture dir
       * @param {string} content new content
       */
      editFile(relative, content) {
        fs.writeFileSync(path.join(dir, relative), content);
      },

      /**
       * @returns {Promise<EXPECTED_ANY>} resolves with the stats of the next completed build
       */
      nextBuild() {
        return new Promise((resolve) => {
          buildWaiters.push(resolve);
        });
      },

      /**
       * Wait until the watcher goes quiet — spurious startup rebuilds (file
       * timestamp granularity, fsevents) broadcast syncs that pollute
       * frame-level assertions.
       * @param {number=} quietMs how long without builds counts as quiet
       * @returns {Promise<void>} resolved when no build happened for quietMs
       */
      async settle(quietMs = 1000) {
        for (;;) {
          const built = await Promise.race([
            new Promise((resolve) => {
              buildWaiters.push(() => resolve(true));
            }),
            new Promise((resolve) => {
              setTimeout(() => resolve(false), quietMs);
            }),
          ]);

          if (!built) {
            return;
          }
        }
      },

      /**
       * Stop only the HTTP server (the compiler keeps watching), severing
       * every open connection so clients see a disconnect.
       * @returns {Promise<void>} resolved when closed
       */
      stopHttp() {
        return new Promise((resolve) => {
          severUpgraded();
          server.closeAllConnections();
          server.close(() => resolve());
        });
      },

      /**
       * Bring the HTTP server back on the same port, retrying while the OS
       * releases it.
       * @returns {Promise<void>} resolved when listening
       */
      async startHttp() {
        server = await listen(port);
        attachTransport(server);
      },

      /**
       * @returns {Promise<void>} resolved when everything is torn down
       */
      async close() {
        await new Promise((resolve) => {
          instance.close(resolve);
        });
        await new Promise((resolve) => {
          if (!server.listening) {
            resolve();
            return;
          }
          severUpgraded();
          server.closeAllConnections();
          server.close(() => resolve());
        });
        removeDir();
      },
    };
  } catch (error) {
    // Partial-failure teardown: without it a broken startup leaks the
    // watcher, the server, and the temp dir for the rest of the run.
    if (instance) {
      await new Promise((resolve) => {
        instance.close(resolve);
      });
    }
    if (server) {
      await new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    }
    removeDir();
    throw error;
  }
}

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

module.exports = createHotApp;
