import collectConsole, { normalizeConsole } from "../helpers/console-collector";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(120000);

const OVERLAY_ID = "webpack-dev-middleware-hot-overlay";

/**
 * Each bundle renders into its own div so the page shows both compilations
 * side by side.
 * @param {string} name bundle name
 * @param {string} text rendered text
 * @returns {string} app source
 */
function bundleApp(name, text) {
  return `
    let el = document.getElementById("out-${name}");
    if (!el) {
      el = document.createElement("div");
      el.id = "out-${name}";
      document.body.append(el);
    }
    el.textContent = ${JSON.stringify(text)};
    if (module.hot) {
      module.hot.accept();
    }
  `;
}

/**
 * @param {import("puppeteer").Page} page page
 * @param {string} id element id
 * @param {string} text expected text
 * @returns {Promise<void>} resolved when rendered
 */
function waitForText(page, id, text) {
  return page
    .waitForFunction(
      (elementId, expected) =>
        document.getElementById(elementId)?.textContent === expected,
      { timeout: 30000 },
      id,
      text,
    )
    .then(() => {});
}

describe("multi-compiler (browser)", () => {
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

  it("updates only the bundle that changed, without reloading the page", async () => {
    app = await createHotApp({
      apps: [
        { name: "app", code: bundleApp("app", "app-v1") },
        { name: "widget", code: bundleApp("widget", "widget-v1") },
      ],
    });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForText(page, "out-app", "app-v1");
    await waitForText(page, "out-widget", "widget-v1");
    await page.evaluate(() => {
      globalThis.__notReloaded = true;
    });

    app.edit("widget", bundleApp("widget", "widget-v2"));
    await waitForText(page, "out-widget", "widget-v2");

    // The sibling bundle was left alone and nothing reloaded — the unchanged
    // bundle's event is a `sync` its own client applies as a no-op, and the
    // `?name=` filter keeps the widget's `built` away from the app's client.
    expect(
      await page.evaluate(() => document.getElementById("out-app").textContent),
    ).toBe("app-v1");
    expect(await page.evaluate(() => globalThis.__notReloaded)).toBe(true);
  });

  it("logs per-bundle lifecycles and deduplicates warning re-logs on sibling builds", async () => {
    // Warnings (unlike build errors) do not block applying updates or force
    // reloads, which keeps the console sequence deterministic enough to
    // snapshot. The `require(<expression>)` produces webpack's "Critical
    // dependency" warning; the template keeps it on a fixed line so the
    // warning text is identical across edits.
    const widgetWithWarning = (text) => `
      let el = document.getElementById("out-widget");
      if (!el) {
        el = document.createElement("div");
        el.id = "out-widget";
        document.body.append(el);
      }
      el.textContent = ${JSON.stringify(text)};
      const dep = "./nothing";
      try {
        require(dep);
      } catch (err) {
        // expected
      }
      if (module.hot) {
        module.hot.accept();
      }
    `;

    app = await createHotApp({
      apps: [
        { name: "app", code: bundleApp("app", "app-v1") },
        { name: "widget", code: widgetWithWarning("widget-v1") },
      ],
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForText(page, "out-app", "app-v1");
    await waitForText(page, "out-widget", "widget-v1");
    // The widget's warning arrives with the connect-time sync, logged once.
    await console_.waitFor("Critical dependency");

    // A sibling's clean rebuild must NOT re-log the widget's unchanged
    // warning (the console cache is per bundle).
    app.edit("app", bundleApp("app", "app-v2"));
    await waitForText(page, "out-app", "app-v2");
    await console_.waitFor("App is up to date");

    // The widget's own rebuild drops its cache, so the identical warning
    // text is logged again.
    app.edit("widget", widgetWithWarning("widget-v2"));
    await waitForText(page, "out-widget", "widget-v2");
    await console_.waitForCount("App is up to date", 2);

    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  it("shows the union of problems from every broken bundle", async () => {
    app = await createHotApp({
      apps: [
        { name: "app", code: bundleApp("app", "app-v1") },
        { name: "widget", code: bundleApp("widget", "widget-v1") },
      ],
    });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForText(page, "out-app", "app-v1");
    await waitForText(page, "out-widget", "widget-v1");

    app.edit("app", "broken app {{{");
    app.edit("widget", "broken widget {{{");

    const handle = await page.waitForSelector(`#${OVERLAY_ID}`, {
      timeout: 30000,
    });
    const frame = await handle.contentFrame();

    // Both bundles' problems share the overlay: the pager counts the union
    // (one problem per page; which bundle finishes breaking first varies).
    await frame.waitForFunction(
      () => document.body.textContent.includes("1 / 2"),
      { timeout: 30000 },
    );

    const firstPage = await frame.evaluate(() => document.body.textContent);

    await frame.click('[aria-label="Next problem"]');
    await frame.waitForFunction(
      () => document.body.textContent.includes("2 / 2"),
      { timeout: 30000 },
    );

    const secondPage = await frame.evaluate(() => document.body.textContent);
    const union = firstPage + secondPage;

    expect(union).toContain("broken app {{{");
    expect(union).toContain("broken widget {{{");
  });

  it("keeps one bundle's overlay errors while a sibling rebuilds successfully", async () => {
    app = await createHotApp({
      apps: [
        { name: "app", code: bundleApp("app", "app-v1") },
        { name: "widget", code: bundleApp("widget", "widget-v1") },
      ],
    });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForText(page, "out-app", "app-v1");

    app.edit("widget", "broken widget {{{");
    const handle = await page.waitForSelector(`#${OVERLAY_ID}`, {
      timeout: 30000,
    });
    const frame = await handle.contentFrame();

    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "Module parse failed",
    );

    // A sibling's successful rebuild applies its update but must not wipe the
    // widget's problems from the shared overlay.
    app.edit("app", bundleApp("app", "app-v2"));
    await waitForText(page, "out-app", "app-v2");

    expect(await page.$(`#${OVERLAY_ID}`)).not.toBeNull();
    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "Module parse failed",
    );

    app.edit("widget", bundleApp("widget", "widget-v2"));
    await page.waitForFunction(
      (id) => document.getElementById(id) === null,
      { timeout: 30000 },
      OVERLAY_ID,
    );
    await waitForText(page, "out-widget", "widget-v2");
  });
});
