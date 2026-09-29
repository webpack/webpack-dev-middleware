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
 * @returns {Promise<EXPECTED_ANY[]>} what the worker has sent
 */
async function waitForMessages(page, count) {
  await page.waitForFunction(
    (expected) => globalThis.__fromWorker.length >= expected,
    { polling: 100, timeout: 60000 },
    count,
  );

  return page.evaluate(() => globalThis.__fromWorker);
}

// The client has no `window` here and no document to put an overlay in. What
// it does have is the transport and webpack's runtime, which is all that
// applying an update needs.
describe("the client inside a web worker", () => {
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
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForMessages(page, 1);

    app.edit(workerApp("v2"));

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
