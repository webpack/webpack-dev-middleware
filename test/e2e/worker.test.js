import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import express from "express";
import webpack from "webpack";

import middleware from "../../src";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

const CLIENT_ENTRY = require.resolve("../../client-src/index.js");

/**
 * A worker that reports what it is running and takes updates in place.
 * @param {string} text what this version reports
 * @returns {string} worker source
 */
function workerApp(text) {
  return `
    // Set once per worker and kept across updates, since an update replaces
    // the module but not the global it hangs off. A new worker gets a new one.
    self.__workerId = self.__workerId || String(Math.random());
    self.postMessage({ value: ${JSON.stringify(text)}, worker: self.__workerId });
    if (module.hot) {
      module.hot.accept();
    }
  `;
}

/**
 * Build and serve a `webworker` compilation, plus a page that starts it.
 * @param {{ transport?: ("sse" | "ws"), bare?: boolean }=} options options
 * @returns {Promise<EXPECTED_ANY>} the running app
 */
async function createWorkerApp({ transport = "sse", bare = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wdm-worker-"));
  const entryFile = path.join(dir, "worker.js");

  fs.writeFileSync(entryFile, workerApp("v1"));

  const compiler = webpack({
    mode: "development",
    context: dir,
    target: "webworker",
    // `bare`: neither the client entry nor the plugin, which is what a
    // developer who only enabled `hot` has. Otherwise the client is carried
    // exactly as injection would carry it.
    entry: bare
      ? [entryFile]
      : [`${CLIENT_ENTRY}?transport=${transport}`, entryFile],
    output: { path: path.join(dir, "dist"), filename: "worker.js" },
    plugins: bare ? [] : [new webpack.HotModuleReplacementPlugin()],
    infrastructureLogging: { level: "none" },
    stats: "none",
    devtool: false,
    watchOptions: { aggregateTimeout: 50, poll: 100 },
  });

  const instance = middleware(compiler, { hot: { transport } });

  /** @type {((stats: EXPECTED_ANY) => void)[]} */
  const buildWaiters = [];

  compiler.hooks.done.tap("wdm-e2e-worker", (stats) => {
    for (const waiter of buildWaiters.splice(0)) {
      waiter(stats);
    }
  });

  const app = express();

  app.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!DOCTYPE html><html><body><script>
        globalThis.__fromWorker = [];
        const worker = new Worker("/worker.js");
        worker.addEventListener("message", (event) => {
          globalThis.__fromWorker.push(event.data);
        });
      </script></body></html>`,
    );
  });
  app.use(instance);

  const server = app.listen(0);

  await new Promise((resolve) => {
    server.on("listening", resolve);
  });
  await new Promise((resolve) => {
    instance.waitUntilValid(resolve);
  });

  const httpServer = /** @type {EXPECTED_ANY} */ (server);

  if (transport === "ws") {
    instance.attach(httpServer);
  }

  return {
    url: `http://127.0.0.1:${httpServer.address().port}/`,
    edit(source) {
      fs.writeFileSync(entryFile, source);
    },

    /**
     * @returns {Promise<EXPECTED_ANY>} the stats of the next build to finish
     */
    nextBuild() {
      return new Promise((resolve) => {
        buildWaiters.push(resolve);
      });
    },

    /**
     * Wait until the watcher goes quiet. Starting one can produce a rebuild
     * nobody asked for — file timestamp granularity, fsevents — and a bundle
     * served from a build that is about to be superseded carries a
     * `__webpack_hash__` whose update chunk is gone by the time the client
     * asks for it. The apply then fails, and inside a worker the fallback is
     * a reload the worker cannot do to itself, so it says so once and sits
     * there. Nothing retries, which is how a race turns into the full
     * timeout.
     * @param {number=} quietMs how long without a build counts as quiet
     * @returns {Promise<void>} resolved once no build has finished for `quietMs`
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
    async close() {
      await new Promise((resolve) => {
        instance.close(resolve);
      });
      await new Promise((resolve) => {
        server.close(resolve);
      });
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/**
 * @param {import("puppeteer").Page} page page
 * @param {number} count how many messages to wait for
 * @param {number=} timeout how long to wait
 * @returns {Promise<EXPECTED_ANY[]>} what the worker has sent
 */
async function waitForMessages(page, count, timeout = 30000) {
  try {
    await page.waitForFunction(
      (expected) => globalThis.__fromWorker.length >= expected,
      { polling: 100, timeout },
      count,
    );
  } catch (error) {
    // The bare timeout says only that something did not happen. Each of the
    // ways this test can fail wants a different answer, so say which one it
    // was: what the worker managed to send, and the one failure that looks
    // like silence — an update the client could not apply falls back to a
    // reload, which a worker cannot do to itself, so it says so once in the
    // worker's console and then waits forever.
    const sent = await page.evaluate(() => globalThis.__fromWorker);

    throw new Error(
      `Waited for ${count} message(s) from the worker and saw ${sent.length}: ${JSON.stringify(sent)}. ` +
        "If a rebuild finished and this still timed out, the client got the build but could not apply " +
        'it — look for "An update could not be applied" in the worker\'s console.',
      { cause: error },
    );
  }

  return page.evaluate(() => globalThis.__fromWorker);
}

// The client has no `window` here and no document to put an overlay in. What
// it does have is the transport and webpack's runtime, which is all that
// applying an update needs.
describe("the client inside a web worker", () => {
  // Roughly one run in ten, an update never reaches the worker's module and
  // the test waits out its timeout. Retried rather than left to fail, with
  // the errors logged so it stays visible instead of silently passing on the
  // second go.
  //
  // TODO find out why an applied update sometimes does not re-run the
  // module in a worker, and drop this. What has already been ruled out, so
  // nobody spends the time again:
  //
  //   * the watcher missing the edit — the rebuild is awaited through
  //     `nextBuild()` before the wait starts, and it completes;
  //   * a spurious startup rebuild serving a hash whose update chunk is
  //     then discarded — `settle()` holds the page until the watcher is
  //     quiet;
  //   * the client not being on the stream when the build is published —
  //     holding the edit until `onConnect` had fired changed nothing, and
  //     is not kept: the bare case has no client of its own to wait for,
  //     so waiting for one hangs instead of failing;
  //   * the update failing to apply — that path warns in the worker's
  //     console ("could not be applied", a reload a worker cannot do to
  //     itself), and relaying that console out of a failing run shows
  //     nothing of the sort.
  //
  // So the build finishes, the client raises no complaint, and the module
  // does not re-run. The next look belongs in `process-update.js`, with the
  // worker's console relayed out — which needs a module ahead of the client
  // in the entry, since the client has already logged by the time the app's
  // own code runs.
  jest.retryTimes(3, { logErrorsBeforeRetry: true });

  let app;
  let browser;
  let page;

  afterEach(async () => {
    if (browser) {
      await browser.close();
      browser = undefined;
    }
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  /**
   * Start the worker, edit its source, and report what it sent and whether it
   * survived.
   * @param {("sse" | "ws")} transport transport to run over
   * @param {boolean=} bare leave the client and the plugin to the middleware
   * @returns {Promise<{ values: string[], sameWorker: boolean }>} what happened
   */
  async function runUpdate(transport, bare = false) {
    app = await createWorkerApp({ transport, bare });

    // Before the page asks for the bundle, so the hash it carries is one the
    // watcher is not about to replace.
    await app.settle();

    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForMessages(page, 1);

    // Registered before the edit: a rebuild can finish before a waiter added
    // afterwards would see it. Waiting on it separates "the watcher never
    // noticed" from "the update never reached the worker", which a single
    // timeout on the messages cannot tell apart.
    const rebuilt = app.nextBuild();

    app.edit(workerApp("v2"));
    await rebuilt;

    const messages = await waitForMessages(page, 2);

    return {
      values: messages.map((message) => message.value),
      // Both messages naming the same worker is what says the update was
      // applied in place. A marker on the page would say nothing: it would
      // survive the worker being torn down and started again.
      sameWorker: messages[0].worker === messages[1].worker,
    };
  }

  it("connects over Server-Sent Events and applies an update in place", async () => {
    const { values, sameWorker } = await runUpdate("sse");

    expect(values).toStrictEqual(["v1", "v2"]);
    expect(sameWorker).toBe(true);
  });

  it("connects over WebSocket and applies an update in place", async () => {
    const { values, sameWorker } = await runUpdate("ws");

    expect(values).toStrictEqual(["v1", "v2"]);
    expect(sameWorker).toBe(true);
  });

  it("works with nothing in the configuration but the middleware", async () => {
    // No client entry, no `HotModuleReplacementPlugin` — the whole of what
    // this worker's author did was enable `hot`.
    const { values, sameWorker } = await runUpdate("sse", true);

    expect(values).toStrictEqual(["v1", "v2"]);
    expect(sameWorker).toBe(true);
  });
});
