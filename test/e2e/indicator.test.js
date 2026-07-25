import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(120000);

const INDICATOR_ID = "webpack-dev-middleware-building-indicator";

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
