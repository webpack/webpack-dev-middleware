const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const express = require("express");
const webpack = require("webpack");

const middleware = require("../../src");

const CLIENT_ENTRY = require.resolve("../../client-src/index.js");

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
 * @param {{ query?: string, code?: string, files?: Record<string, string>, apps?: { name: string, code: string }[], hot?: EXPECTED_ANY, pageHeaders?: Record<string, string>, publicPath?: string, setup?: (server: EXPECTED_ANY) => void, hmrPlugin?: boolean }} options options
 * @returns {Promise<EXPECTED_ANY>} handles for the running app
 */
async function createHotApp({
  query = "",
  code,
  files = {},
  apps,
  hot = true,
  pageHeaders = {},
  publicPath = "/",
  setup,
  hmrPlugin = true,
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

    if (apps) {
      config = apps.map((app) => {
        // One context dir per compilation: editing one app's entry must not
        // invalidate the sibling compiler through the shared directory, or
        // the order of the two `building` events becomes nondeterministic.
        const appDir = path.join(dir, app.name);
        fs.mkdirSync(appDir, { recursive: true });
        entryFiles[app.name] = path.join(appDir, "entry.js");
        fs.writeFileSync(entryFiles[app.name], app.code);
        return makeConfig(app.name, appDir, entryFiles[app.name], query);
      });
      scripts = apps.map((app) => `/${app.name}.js`);
    } else {
      entryFiles[""] = path.join(dir, "app.js");
      fs.writeFileSync(entryFiles[""], /** @type {string} */ (code));
      config = makeConfig(
        "",
        dir,
        entryFiles[""],
        query,
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

    instance = middleware(compiler, { hot });

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

    server = await listen(0);
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
       * Stop only the HTTP server (the compiler keeps watching), severing
       * every open connection so clients see a disconnect.
       * @returns {Promise<void>} resolved when closed
       */
      stopHttp() {
        return new Promise((resolve) => {
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
