import collectConsole, { normalizeConsole } from "../helpers/console-collector";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(120000);

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

describe("client logging (browser)", () => {
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

  it("logs a full update cycle at the default info level, with the prefix", async () => {
    hotApp = await createHotApp({ code: app("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    hotApp.edit(app("v2"));
    await waitForAppText(page, "v2");
    await console_.waitFor("App is up to date");

    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  it("logging=none silences the whole cycle", async () => {
    hotApp = await createHotApp({ query: "?logging=none", code: app("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    hotApp.edit(app("v2"));
    await waitForAppText(page, "v2");

    // The update applied (asserted through the DOM above) — give any stray
    // logging a beat to surface before pinning the silence.
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  it("logging=warn keeps warnings only", async () => {
    hotApp = await createHotApp({
      query: "?logging=warn",
      // `require(<expression>)` produces webpack's "Critical dependency"
      // warning without failing the build.
      code: `
        document.getElementById("app").textContent = "v1";
        const dep = "./nothing";
        try {
          require(dep);
        } catch (err) {
          // expected
        }
        if (module.hot) {
          module.hot.accept();
        }
      `,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    // The warning arrives with the connect-time sync.
    await console_.waitFor("Critical dependency");

    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  it("logging=error keeps errors only", async () => {
    hotApp = await createHotApp({ query: "?logging=error", code: app("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    hotApp.edit("broken {{{");
    await console_.waitFor("Module parse failed");

    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });
});
