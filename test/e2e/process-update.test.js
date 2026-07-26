import collectConsole, { normalizeConsole } from "../helpers/console-collector";
import { acceptedApp, closeE2e, waitForAppText } from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

/**
 * The app accepts ./dep with a handler that throws — the error path HMR
 * cannot recover from in place.
 * @returns {string} app source
 */
function throwingAcceptApp() {
  return `
    require("./dep");
    document.getElementById("app").textContent = "v1";
    if (module.hot) {
      module.hot.accept("./dep.js", () => {
        throw new Error("accept boom");
      });
    }
  `;
}

describe("update processing (browser)", () => {
  let app;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app } = await closeE2e(browser, app));
  });

  it("reloads when an accept handler throws during apply", async () => {
    app = await createHotApp({
      code: throwingAcceptApp(),
      files: { "dep.js": "module.exports = 1;" },
    });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await page.evaluate(() => {
      globalThis.__notReloaded = true;
    });

    app.editFile("dep.js", "module.exports = 2;");

    // The failed apply falls back to a full reload: the marker is wiped.
    await page.waitForFunction(() => globalThis.__notReloaded === undefined, {
      timeout: 30000,
      polling: 100,
    });
    expect(await page.evaluate(() => globalThis.__notReloaded)).toBeUndefined();
  });

  it("stays on the broken state when reload=false and an accept handler throws", async () => {
    app = await createHotApp({
      query: "?reload=false",
      code: throwingAcceptApp(),
      files: { "dep.js": "module.exports = 1;" },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await page.evaluate(() => {
      globalThis.__notReloaded = true;
    });

    app.editFile("dep.js", "module.exports = 2;");
    await console_.waitFor("Ignored an error while updating");

    expect(await page.evaluate(() => globalThis.__notReloaded)).toBe(true);
    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  it("reloads when the announced update cannot be found", async () => {
    app = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");
    await page.evaluate(() => {
      globalThis.__notReloaded = true;
    });

    // A build the server never produced: the real runtime fetches the
    // hot-update manifest, gets a 404, and falls back to a reload.
    app.instance.context.hot.publish({
      action: "built",
      name: "",
      time: 1,
      hash: "0000000000000000",
      errors: [],
      warnings: [],
    });

    await page.waitForFunction(() => globalThis.__notReloaded === undefined, {
      timeout: 30000,
      polling: 100,
    });
    expect(await page.evaluate(() => globalThis.__notReloaded)).toBeUndefined();
  });

  it("ignores sibling bundles once the own compilation is identified", async () => {
    app = await createHotApp({
      // __webpack_hash__ only exists inside the bundle — expose a getter.
      code: `
        globalThis.getHash = () => __webpack_hash__;
        document.getElementById("app").textContent = "v1";
        if (module.hot) {
          module.hot.accept();
        }
      `,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");
    await page.evaluate(() => {
      globalThis.__notReloaded = true;
    });

    const currentHash = await page.evaluate(() => globalThis.getHash());

    // The own sync locks the name…
    app.instance.context.hot.publish({
      action: "sync",
      name: "app",
      time: 1,
      hash: currentHash,
      errors: [],
      warnings: [],
    });
    // …so a sibling's impossible hash is ignored instead of checked.
    app.instance.context.hot.publish({
      action: "built",
      name: "admin",
      time: 1,
      hash: "0000000000000000",
      errors: [],
      warnings: [],
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    expect(await page.evaluate(() => globalThis.__notReloaded)).toBe(true);
    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  it("logs the disabled HMR runtime once and never reloads", async () => {
    app = await createHotApp({
      code: 'document.getElementById("app").textContent = "v1";',
      hmrPlugin: false,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");
    await page.evaluate(() => {
      globalThis.__notReloaded = true;
    });

    app.instance.context.hot.publish({
      action: "built",
      name: "",
      time: 1,
      hash: "aaaa",
      errors: [],
      warnings: [],
    });
    await console_.waitFor("Hot Module Replacement is disabled");
    app.instance.context.hot.publish({
      action: "built",
      name: "",
      time: 1,
      hash: "bbbb",
      errors: [],
      warnings: [],
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    expect(await page.evaluate(() => globalThis.__notReloaded)).toBe(true);
    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });
});
