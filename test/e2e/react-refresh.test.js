import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import ReactRefreshPlugin from "@pmmmwh/react-refresh-webpack-plugin";
import express from "express";
import webpack from "webpack";

import middleware from "../../src";
import collectConsole from "../helpers/console-collector";
import { closeE2e } from "../helpers/e2e";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

const OVERLAY_ID = "webpack-dev-middleware-hot-overlay";
const NODE_MODULES = path.resolve(__dirname, "../../node_modules");

// What `react-refresh/babel` makes of a module: each component registered
// with Fast Refresh, and a component's hooks summed up as a signature it
// compares across edits. Written out rather than produced by babel-loader,
// which cannot load `@babel/core` inside this test runner on every Node.js
// version CI uses; the plugin's own loader does the rest.

/**
 * A component with state of its own, which Fast Refresh keeps across an edit.
 * @param {string} text what the button says before the count
 * @param {{ hooks?: boolean, crash?: boolean }=} options a second hook, which changes the component's hook signature; or a render that throws
 * @returns {string} the module's source
 */
function component(text, { hooks = false, crash = false } = {}) {
  return `var _s = $RefreshSig$();
import { createElement, useState } from "react";
import Child from "./Child.js";

export default function App() {
  _s();
  const [count, setCount] = useState(0);
${hooks ? '  const [other] = useState("other");\n' : ""}${crash ? '  throw new Error("Render failed on purpose");\n' : ""}
  return createElement(
    "div",
    null,
    createElement(
      "button",
      { id: "counter", onClick: () => setCount(count + 1) },
      ${JSON.stringify(text)} + " " + count,
    ),
    createElement(Child),
  );
}

_s(App, ${JSON.stringify(hooks ? "useState{count} useState{other}" : "useState{count}")});
var _c = App;
$RefreshReg$(_c, "App");
`;
}

/**
 * @param {string} text what the child says
 * @returns {string} the module's source
 */
function child(text) {
  return `import { createElement } from "react";

export default function Child() {
  return createElement("p", { id: "child" }, ${JSON.stringify(text)});
}

var _c = Child;
$RefreshReg$(_c, "Child");
`;
}

const INDEX = `import { createElement } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { label } from "./label.js";

const container = document.getElementById("root");

container.dataset.label = label;
createRoot(container).render(createElement(App));
`;

/**
 * A React app with Fast Refresh, served by the middleware with its own client.
 * The plugin's overlay reads webpack-dev-server's or webpack-hot-middleware's
 * messages, not this one's, so the middleware's overlay is the one shown.
 * @param {EXPECTED_ANY} hot the `hot` option
 * @returns {Promise<EXPECTED_ANY>} the running app
 */
async function serve(hot) {
  const dir = fs.mkdtempSync(
    path.join(fs.realpathSync.native(os.tmpdir()), "wdm-react-refresh-"),
  );
  const files = {
    app: path.join(dir, "App.js"),
    child: path.join(dir, "Child.js"),
    label: path.join(dir, "label.js"),
  };

  // The plugin's loader writes ES module code for a package that says it is
  // one.
  fs.writeFileSync(path.join(dir, "package.json"), '{ "type": "module" }\n');
  fs.writeFileSync(path.join(dir, "index.js"), INDEX);
  fs.writeFileSync(files.app, component("Clicked"));
  fs.writeFileSync(files.child, child("child v1"));
  fs.writeFileSync(files.label, 'export const label = "first";\n');

  const compiler = webpack({
    mode: "development",
    devtool: false,
    context: dir,
    entry: "./index.js",
    output: { path: path.join(dir, "dist"), publicPath: "/" },
    resolve: { modules: [NODE_MODULES, "node_modules"] },
    plugins: [new ReactRefreshPlugin({ overlay: false })],
    infrastructureLogging: { level: "none" },
    stats: "none",
    watchOptions: { aggregateTimeout: 50, poll: 100 },
  });
  const instance = middleware(compiler, { hot });
  const app = express();

  app.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!DOCTYPE html><html><head><title>react refresh</title></head><body><div id="root"></div><script src="/main.js"></script></body></html>',
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
    /**
     * @param {"app" | "child" | "label"} name which module
     * @param {string} source its new source
     */
    edit(name, source) {
      fs.writeFileSync(files[name], source);
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

/**
 * @param {import("puppeteer").Page} page page
 * @param {string} selector what to read
 * @param {string | RegExp} text what it should say
 * @returns {Promise<void>} resolved once it does
 */
function waitForText(page, selector, text) {
  const pattern = typeof text === "string" ? `^${text}$` : text.source;

  return page
    .waitForFunction(
      (target, source) =>
        new RegExp(source).test(
          document.querySelector(target)?.textContent || "",
        ),
      { timeout: 60000, polling: 100 },
      selector,
      pattern,
    )
    .then(() => {});
}

// `@pmmmwh/react-refresh-webpack-plugin` with the middleware's own client:
// Fast Refresh is applied by this client, so each hot scenario a React project
// relies on is checked here, where a change to the client would break it.
describe.each([
  ["Server-Sent Events", {}],
  ["a WebSocket", { transport: "ws" }],
])("React Refresh over %s (browser)", (_title, hot) => {
  let served;
  let browser;
  let page;
  let console_;
  /** @type {string[]} */
  let pageErrors;

  /**
   * @returns {Promise<boolean>} whether the page is still the one first loaded
   */
  function notReloaded() {
    return page.evaluate(() => globalThis.notReloaded === true);
  }

  beforeEach(async () => {
    served = await serve(hot);
    ({ page, browser } = await runBrowser());
    console_ = collectConsole(page);
    pageErrors = [];
    page.on("pageerror", (error) => {
      pageErrors.push(String(error));
    });

    await page.goto(served.url);
    await waitForText(page, "#counter", "Clicked 0");
    await console_.waitFor("connected");
    await page.click("#counter");
    await page.click("#counter");
    await waitForText(page, "#counter", "Clicked 2");
    await page.evaluate(() => {
      globalThis.notReloaded = true;
    });
  });

  afterEach(async () => {
    ({ browser, app: served } = await closeE2e(browser, served));
  });

  it("keeps a component's state across an edit", async () => {
    served.edit("app", component("Pressed"));

    await waitForText(page, "#counter", "Pressed 2");

    expect(await notReloaded()).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  it("keeps it across several edits in a row", async () => {
    for (const text of ["One", "Two", "Three"]) {
      served.edit("app", component(text));
      await waitForText(page, "#counter", `${text} 2`);
    }

    await page.click("#counter");
    await waitForText(page, "#counter", "Three 3");

    expect(await notReloaded()).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  it("updates a component in another module, and keeps its parent's state", async () => {
    served.edit("child", child("child v2"));

    await waitForText(page, "#child", "child v2");

    expect(await page.$eval("#counter", (node) => node.textContent)).toBe(
      "Clicked 2",
    );
    expect(await notReloaded()).toBe(true);
  });

  it("remounts a component whose hooks changed, without reloading the page", async () => {
    // Fast Refresh cannot carry state across a different set of hooks, so it
    // starts the component over — in place.
    served.edit("app", component("Hooked", { hooks: true }));

    await waitForText(page, "#counter", "Hooked 0");

    expect(await notReloaded()).toBe(true);
  });

  it("shows a build error, and applies the fix in place", async () => {
    served.edit("app", `${component("Pressed")}\nexport const broken = ;\n`);

    await page.waitForSelector(`#${OVERLAY_ID}`, { timeout: 60000 });

    served.edit("app", component("Fixed"));

    await waitForText(page, "#counter", "Fixed 2");
    await page.waitForFunction(
      (id) => !document.getElementById(id),
      { timeout: 60000 },
      OVERLAY_ID,
    );

    expect(await notReloaded()).toBe(true);
  });

  it("shows an error thrown while rendering, and renders again once fixed", async () => {
    served.edit("app", component("Pressed", { crash: true }));

    await page.waitForSelector(`#${OVERLAY_ID}`, { timeout: 60000 });

    served.edit("app", component("Fixed"));

    // The failed root is rendered again by Fast Refresh, not by a reload.
    await waitForText(page, "#counter", /^Fixed \d+$/);

    expect(await notReloaded()).toBe(true);
  });

  it("reloads the page for an edit no component accepts", async () => {
    served.edit("label", 'export const label = "second";\n');

    await page.waitForFunction(
      () => document.querySelector("#root")?.dataset.label === "second",
      { timeout: 60000, polling: 100 },
    );
    await waitForText(page, "#counter", "Clicked 0");

    expect(await page.evaluate(() => globalThis.notReloaded)).toBeUndefined();
  });
});
