import collectConsole from "../helpers/console-collector";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(120000);

const CLIENT_ENTRY = require.resolve("../../client-src/index.js");

/**
 * A self-accepting module: HMR updates re-run it in place.
 * @param {string} text text rendered into #app
 * @returns {string} app source
 */
function acceptedApp(text) {
  return `
    document.getElementById("app").textContent = ${JSON.stringify(text)};
    if (module.hot) {
      module.hot.accept();
    }
  `;
}

/**
 * A module that never accepts updates — applying one needs a full reload.
 * @param {string} text text rendered into #app
 * @returns {string} app source
 */
function unacceptedApp(text) {
  return `document.getElementById("app").textContent = ${JSON.stringify(text)};`;
}

/**
 * @param {import("puppeteer").Page} page page
 * @param {string} text expected #app text
 * @returns {Promise<void>} resolved when rendered
 */
function waitForAppText(page, text) {
  return page
    .waitForFunction(
      (expected) => document.getElementById("app")?.textContent === expected,
      { timeout: 30000 },
      text,
    )
    .then(() => {});
}

/**
 * Plant a marker that survives HMR but not a navigation.
 * @param {import("puppeteer").Page} page page
 * @returns {Promise<void>} resolved when set
 */
async function plantReloadMarker(page) {
  await page.evaluate(() => {
    globalThis.__notReloaded = true;
  });
}

/**
 * @param {import("puppeteer").Page} page page
 * @returns {Promise<boolean | undefined>} marker value (undefined after a reload)
 */
function readReloadMarker(page) {
  return page.evaluate(() => globalThis.__notReloaded);
}

describe("hot client (browser)", () => {
  let app;
  let browser;
  let page;

  afterEach(async () => {
    // try/finally: a rejected browser.close() must not leak the watcher,
    // the server, and the temp dir behind it.
    try {
      if (browser) {
        await browser.close();
      }
    } finally {
      browser = undefined;
      if (app) {
        const closing = app;
        app = undefined;
        await closing.close();
      }
    }
  });

  it("connects and applies an update without reloading the page", async () => {
    app = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    await plantReloadMarker(page);

    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(await readReloadMarker(page)).toBe(true);
  });

  it("falls back to a full reload when the update is not accepted", async () => {
    app = await createHotApp({ code: unacceptedApp("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(unacceptedApp("v2"));

    // The reload wipes the marker and the new code renders.
    await waitForAppText(page, "v2");
    expect(await readReloadMarker(page)).toBeUndefined();
  });

  it("warns instead of reloading when reload=false", async () => {
    app = await createHotApp({
      query: "?reload=false",
      code: unacceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(unacceptedApp("v2"));
    await console_.waitFor("couldn't be hot updated");

    // Old code keeps running and the page did not reload.
    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v1");
    expect(await readReloadMarker(page)).toBe(true);
  });

  it("reconnects after a server restart and syncs up on missed builds", async () => {
    app = await createHotApp({
      query: "?timeout=1000",
      code: acceptedApp("v1"),
      // Heartbeats faster than the shortened timeout, so the inactivity
      // watchdog does not churn disconnect/reconnect cycles mid-test.
      hot: { heartbeat: 300 },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");
    await plantReloadMarker(page);

    // Rebuild while the server is down — the client must pick the update up
    // through the catch-up sync after it reconnects.
    await app.stopHttp();
    const rebuilt = app.nextBuild();
    app.edit(acceptedApp("v2"));
    await rebuilt;
    await app.startHttp();

    await waitForAppText(page, "v2");
    expect(await readReloadMarker(page)).toBe(true);
  });

  it("routes server publish() payloads to subscribe handlers", async () => {
    app = await createHotApp({
      code: `
        const hotClient = require(${JSON.stringify(CLIENT_ENTRY)});
        hotClient.subscribe((payload) => {
          globalThis.__custom = payload;
        });
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

    // The documented custom-events API: server-side publish, client-side
    // subscribe for payloads whose action the client does not recognise.
    app.instance.context.hot.publish({ action: "my-event", value: 42 });

    await page.waitForFunction(
      () => globalThis.__custom && globalThis.__custom.value === 42,
      { timeout: 30000 },
    );
    expect(await page.evaluate(() => globalThis.__custom.action)).toBe(
      "my-event",
    );
  });

  it("disconnect() during the reconnect window cancels the pending reconnect", async () => {
    app = await createHotApp({
      query: "?timeout=1000",
      hot: { heartbeat: 300 },
      code: `
        globalThis.hotClient = require(${JSON.stringify(CLIENT_ENTRY)});
        document.getElementById("app").textContent = "v1";
        if (module.hot) {
          module.hot.accept();
        }
      `,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await console_.waitFor("connected");

    // Sever the connection (a reconnect gets scheduled ~1s out), disconnect
    // inside that window, then bring the server back.
    await app.stopHttp();
    await page.evaluate(() => globalThis.hotClient.disconnect());
    await app.startHttp();

    const rebuilt = app.nextBuild();
    app.edit(acceptedApp("v2"));
    await rebuilt;

    // Enough time for the cancelled reconnect to have fired if it survived.
    await new Promise((resolve) => {
      setTimeout(resolve, 3000);
    });

    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v1");
  });

  it("disconnect() closes the connection and stops receiving updates", async () => {
    app = await createHotApp({
      code: `
        globalThis.hotClient = require(${JSON.stringify(CLIENT_ENTRY)});
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

    await page.evaluate(() => globalThis.hotClient.disconnect());

    const rebuilt = app.nextBuild();
    app.edit(acceptedApp("v2"));
    await rebuilt;

    // Grace period: were the connection still alive, the update would land
    // well within it.
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });

    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v1");
  });
});
