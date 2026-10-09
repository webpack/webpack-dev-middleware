import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import express from "express";
import webpack from "webpack";

import middleware from "../../src";
import { closeE2e, waitForAppText } from "../helpers/e2e";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/**
 * An app that runs anywhere: it renders only where there is a page.
 * @param {string} text text rendered into #app
 * @returns {string} app source
 */
function universalApp(text) {
  return `if (typeof document !== "undefined") {
  document.getElementById("app").textContent = ${JSON.stringify(text)};
}

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
`;
}

/**
 * A universal build is an ES module, so the page loads it as one.
 * @param {string | string[]} target webpack target
 * @param {EXPECTED_ANY} hot `hot` option
 * @returns {Promise<EXPECTED_ANY>} the running app
 */
async function serve(target, hot) {
  const dir = fs.mkdtempSync(
    path.join(fs.realpathSync.native(os.tmpdir()), "wdm-universal-e2e-"),
  );
  const entry = path.join(dir, "app.js");

  fs.writeFileSync(entry, universalApp("v1"));

  const compiler = webpack({
    mode: "development",
    devtool: false,
    context: dir,
    entry,
    target,
    output: { path: path.join(dir, "dist"), publicPath: "/" },
    infrastructureLogging: { level: "none" },
    stats: "none",
    watchOptions: { aggregateTimeout: 50, poll: 100 },
  });
  const instance = middleware(compiler, { hot });
  const app = express();

  app.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!DOCTYPE html><html><head><title>universal</title></head><body><div id="app"></div><script type="module" src="/main.mjs"></script></body></html>',
    );
  });
  app.use(instance);

  const server = await new Promise((resolve, reject) => {
    const created = app.listen(0);

    created.once("listening", () => resolve(created));
    created.once("error", reject);
  });

  if (hot.transport === "ws") {
    instance.attach(server);
  }

  await new Promise((resolve) => {
    instance.waitUntilValid(resolve);
  });

  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    edit(source) {
      fs.writeFileSync(entry, source);
    },
    async close() {
      await new Promise((resolve) => {
        instance.close(resolve);
      });
      server.closeAllConnections();
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
    },
  };
}

// The browser half of a universal build, which `../universal-target.test.js`
// runs in Node: the client the bundle carries for a page works there as it
// does in a `web` build.
describe("a universal build (browser)", () => {
  /** @type {[string, EXPECTED_ANY, string][]} */
  const clients = [
    [
      "the client over Server-Sent Events",
      {},
      "webpack-dev-middleware-hot-overlay",
    ],
    [
      "the client over a WebSocket",
      { transport: "ws" },
      "webpack-dev-middleware-hot-overlay",
    ],
  ];
  // Both spellings of the target, for each transport.
  const cases = ["universal", ["web", "node"]].flatMap((target) =>
    clients.map(([title, hot, overlayId]) => [title, target, hot, overlayId]),
  );

  let served;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app: served } = await closeE2e(browser, served));
  });

  it.each(cases)(
    "updates the page and shows the overlay with %s, built for %j",
    async (_title, target, hot, overlayId) => {
      served = await serve(target, hot);
      ({ page, browser } = await runBrowser());

      /** @type {string[]} */
      const pageErrors = [];

      page.on("pageerror", (error) => {
        pageErrors.push(String(error));
      });

      await page.goto(served.url);
      await waitForAppText(page, "v1");
      await page.evaluate(() => {
        globalThis.notReloaded = true;
      });

      // Applied in place.
      served.edit(universalApp("v2"));
      await waitForAppText(page, "v2");

      expect(await page.evaluate(() => globalThis.notReloaded)).toBe(true);

      served.edit("export const broken = ;");
      await page.waitForSelector(`#${overlayId}`, { timeout: 30000 });

      served.edit(universalApp("v3"));
      await waitForAppText(page, "v3");
      await page.waitForFunction(
        (id) => !document.getElementById(id),
        { timeout: 30000 },
        overlayId,
      );

      expect(pageErrors).toEqual([]);
    },
  );
});
