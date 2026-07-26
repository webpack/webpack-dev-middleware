import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

const INDICATOR_ID = "webpack-dev-middleware-building-indicator";
const INDICATOR_ENTRY = require.resolve("../../client-src/indicator.js");
const INDICATOR_STATE_KEY = "__webpack_dev_middleware_hot_indicator_state__";

/**
 * @param {string} text text rendered into #app
 * @returns {string} app source
 */
function app(text) {
  return `
    document.getElementById("app").textContent = ${JSON.stringify(text)};
    if (module.hot) {
      module.hot.accept();
    }
  `;
}

/**
 * Watch for the badge from inside the page — it only exists for the duration
 * of a rebuild. Presence is recorded race-free by a MutationObserver (an
 * interval could miss a sub-tick rebuild entirely); the badge text, which
 * lives in a shadow root the body observer cannot see into, is additionally
 * sampled on a fast interval.
 * @param {import("puppeteer").Page} page page
 * @returns {Promise<void>} resolved once the watcher is installed
 */
async function installBadgeSampler(page) {
  await page.evaluate((id) => {
    globalThis.__badgeSeen = false;
    globalThis.__badgeTexts = [];

    const record = () => {
      const host = document.getElementById(id);
      if (host) {
        globalThis.__badgeSeen = true;
        globalThis.__badgeTexts.push(
          host.shadowRoot ? host.shadowRoot.textContent : "",
        );
      }
    };

    new MutationObserver(record).observe(document.body, {
      childList: true,
      subtree: true,
    });
    setInterval(record, 10);
  }, INDICATOR_ID);
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

describe("building indicator (browser)", () => {
  let hotApp;
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
      if (hotApp) {
        const closing = hotApp;
        hotApp = undefined;
        await closing.close();
      }
    }
  });

  it("shows the badge during a rebuild and removes it afterwards", async () => {
    hotApp = await createHotApp({ code: app("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await installBadgeSampler(page);

    hotApp.edit(app("v2"));
    await waitForAppText(page, "v2");

    expect(await page.evaluate(() => globalThis.__badgeSeen)).toBe(true);
    // The build finished, so the badge must be gone again.
    await page.waitForFunction(
      (id) => document.getElementById(id) === null,
      { timeout: 30000 },
      INDICATOR_ID,
    );
  });

  it("shows the compilation percentage when hot.progress is enabled", async () => {
    hotApp = await createHotApp({
      code: app("v1"),
      hot: { progress: true },
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await installBadgeSampler(page);

    hotApp.edit(app("v2"));
    await waitForAppText(page, "v2");

    const texts = await page.evaluate(() => globalThis.__badgeTexts);

    expect(texts.some((text) => text.includes("%"))).toBe(true);
  });

  it("never appears when progress=false", async () => {
    hotApp = await createHotApp({
      query: "?progress=false",
      code: app("v1"),
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await installBadgeSampler(page);

    hotApp.edit(app("v2"));
    await waitForAppText(page, "v2");

    expect(await page.evaluate(() => globalThis.__badgeSeen)).toBe(false);
  });
});

describe("indicator shared state across bundled copies (browser)", () => {
  let hotApp;
  let browser;
  let page;

  /**
   * Two real bundled copies of the indicator module — one per compilation —
   * exposed as globals so the tests can drive both from the page.
   * @param {string} globalName global to expose the copy under
   * @returns {string} app source
   */
  const exposeIndicator = (globalName) =>
    `globalThis.${globalName} = require(${JSON.stringify(INDICATOR_ENTRY)});`;

  const start = async () => {
    hotApp = await createHotApp({
      query: "?progress=false",
      apps: [
        { name: "a", code: exposeIndicator("indicatorA") },
        { name: "b", code: exposeIndicator("indicatorB") },
      ],
    });
    ({ page, browser } = await runBrowser());
  };

  afterEach(async () => {
    // try/finally: a rejected browser.close() must not leak the watcher,
    // the server, and the temp dir behind it.
    try {
      if (browser) {
        await browser.close();
      }
    } finally {
      browser = undefined;
      if (hotApp) {
        const closing = hotApp;
        hotApp = undefined;
        await closing.close();
      }
    }
  });

  it("drives a single badge from a second bundled copy", async () => {
    await start();
    await page.goto(hotApp.url);

    const state = await page.evaluate((id) => {
      globalThis.indicatorA.show("Rebuilding…");
      globalThis.indicatorB.show("Rebuilding… 42%", 42);

      const hosts = document.querySelectorAll(`#${id}`);

      return {
        count: hosts.length,
        text: hosts[0] ? hosts[0].shadowRoot.textContent : "",
      };
    }, INDICATOR_ID);

    // One badge, adopted (not stacked) by the second copy, showing its text.
    expect(state.count).toBe(1);
    expect(state.text).toContain("42%");

    // The state is shared, so the first copy's hide() removes the badge the
    // second copy updated.
    await page.evaluate(() => globalThis.indicatorA.hide());
    expect(
      await page.evaluate((id) => document.getElementById(id), INDICATOR_ID),
    ).toBeNull();
  });

  it("keeps the badge while another copy's source is still building", async () => {
    await start();
    await page.goto(hotApp.url);

    await page.evaluate(() => {
      globalThis.indicatorA.show("Rebuilding a…", undefined, "a");
      globalThis.indicatorB.show("Rebuilding b…", undefined, "b");
      globalThis.indicatorB.hide("b");
    });
    expect(
      await page.evaluate(
        (id) => document.getElementById(id) !== null,
        INDICATOR_ID,
      ),
    ).toBe(true);

    await page.evaluate(() => globalThis.indicatorA.hide("a"));
    expect(
      await page.evaluate(
        (id) => document.getElementById(id) !== null,
        INDICATOR_ID,
      ),
    ).toBe(false);
  });

  it("ignores hiding an unknown source and still removes unconditionally", async () => {
    await start();
    await page.goto(hotApp.url);

    await page.evaluate(() => {
      globalThis.indicatorA.show("Rebuilding…", undefined, "a");
      globalThis.indicatorA.hide("unknown");
    });
    expect(
      await page.evaluate(
        (id) => document.getElementById(id) !== null,
        INDICATOR_ID,
      ),
    ).toBe(true);

    // Without a source the badge is removed even with builds pending.
    await page.evaluate(() => globalThis.indicatorA.hide());
    expect(
      await page.evaluate(
        (id) => document.getElementById(id) !== null,
        INDICATOR_ID,
      ),
    ).toBe(false);
  });

  it("fills state fields missing from an older copy's shape", async () => {
    await start();
    // An older package version created a leaner shared state before the
    // bundles load.
    await page.evaluateOnNewDocument((key) => {
      globalThis[key] = { host: null };
    }, INDICATOR_STATE_KEY);
    await page.goto(hotApp.url);

    const count = await page.evaluate((id) => {
      globalThis.indicatorA.show("Rebuilding…");
      return document.querySelectorAll(`#${id}`).length;
    }, INDICATOR_ID);

    expect(count).toBe(1);
  });
});
