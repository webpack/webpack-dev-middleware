import collectConsole, { normalizeConsole } from "../helpers/console-collector";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(120000);

const OVERLAY_ID = "webpack-dev-middleware-hot-overlay";

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
 * @returns {Promise<import("puppeteer").Frame>} the overlay iframe's frame
 */
async function waitForOverlay(page) {
  const handle = await page.waitForSelector(`#${OVERLAY_ID}`, {
    timeout: 30000,
  });

  return handle.contentFrame();
}

/**
 * @param {import("puppeteer").Page} page page
 * @returns {Promise<void>} resolved once the overlay is gone
 */
function waitForNoOverlay(page) {
  return page
    .waitForFunction(
      (id) => document.getElementById(id) === null,
      { timeout: 30000 },
      OVERLAY_ID,
    )
    .then(() => {});
}

describe("error overlay (browser)", () => {
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

  it("shows build errors and clears when the build recovers", async () => {
    hotApp = await createHotApp({ code: app("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);

    hotApp.edit("this is not valid javascript {{{");
    const frame = await waitForOverlay(page);
    const text = await frame.evaluate(() => document.body.textContent);

    expect(text).toContain("Module parse failed");

    hotApp.edit(app("fixed"));
    await waitForNoOverlay(page);

    // The recovery build also applies (directly or via the full-reload
    // fallback, depending on how webpack chained the broken build's hashes).
    await page.waitForFunction(
      () => document.getElementById("app")?.textContent === "fixed",
      { timeout: 30000 },
    );
    expect(await page.$(`#${OVERLAY_ID}`)).toBeNull();
  });

  it("dismisses the overlay when pressing Escape on the host page", async () => {
    hotApp = await createHotApp({ code: app("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);

    hotApp.edit("also broken {{{");
    await waitForOverlay(page);

    await page.keyboard.press("Escape");
    await waitForNoOverlay(page);

    expect(await page.$(`#${OVERLAY_ID}`)).toBeNull();
  });

  it("catches runtime errors and renders their message as text, not markup", async () => {
    hotApp = await createHotApp({
      // The error must be thrown from the page's own script — errors raised
      // inside evaluate() surface to window.onerror as opaque "Script error".
      code: `
        document.getElementById("app").textContent = "v1";
        globalThis.boom = (message) => {
          setTimeout(() => {
            throw new Error(message);
          }, 0);
        };
      `,
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await page.waitForFunction(
      () => document.getElementById("app")?.textContent === "v1",
    );

    // The message doubles as an XSS probe: it must render as text.
    await page.evaluate(() => {
      globalThis.boom('runtime boom <img src=x onerror="window.__xss=1">');
    });

    const frame = await waitForOverlay(page);
    const text = await frame.evaluate(() => document.body.textContent);

    expect(text).toContain("runtime boom");
    expect(
      await frame.evaluate(() => document.querySelector("img") !== null),
    ).toBe(false);
    // The onerror payload would run in the iframe's realm — check it there.
    expect(await frame.evaluate(() => globalThis.__xss)).toBeUndefined();
  });

  it("shows build warnings (dev-server parity)", async () => {
    hotApp = await createHotApp({
      // `require(<expression>)` produces webpack's "Critical dependency"
      // warning without failing the build.
      code: `
        document.getElementById("app").textContent = "v1";
        const dep = "./nothing";
        try {
          require(dep);
        } catch (err) {
          // expected — the request cannot be resolved at runtime
        }
        if (module.hot) {
          module.hot.accept();
        }
      `,
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);

    // The warning arrives with the connect-time sync — no rebuild needed.
    const frame = await waitForOverlay(page);
    const text = await frame.evaluate(() => document.body.textContent);

    expect(text).toContain("WARNING");
    expect(text).toContain("Critical dependency");

    // A build without the warning clears the overlay again.
    hotApp.edit(app("fixed"));
    await waitForNoOverlay(page);
    expect(await page.$(`#${OVERLAY_ID}`)).toBeNull();
  });

  it('overlay={"warnings":false} suppresses warnings (dev-server shape)', async () => {
    hotApp = await createHotApp({
      query: '?overlay={"warnings":false}',
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
    // The warning still reaches the console — just not the DOM.
    await console_.waitFor("Critical dependency");

    expect(await page.$(`#${OVERLAY_ID}`)).toBeNull();
  });

  it("applies a warnings filter function from the query (dev-server parity)", async () => {
    hotApp = await createHotApp({
      query:
        '?overlay={"warnings":"function(message){return message.includes(`a.js`)}"}',
      // Two warning-producing modules; the filter keeps only a.js's warning.
      code: `
        document.getElementById("app").textContent = "v1";
        try {
          require("./a");
        } catch (err) {
          // expected
        }
        try {
          require("./b");
        } catch (err) {
          // expected
        }
        if (module.hot) {
          module.hot.accept();
        }
      `,
      files: {
        "a.js":
          'const depA = "./nothing"; try { require(depA); } catch (err) {}',
        "b.js":
          'const depB = "./nothing"; try { require(depB); } catch (err) {}',
      },
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);

    const frame = await waitForOverlay(page);
    const text = await frame.evaluate(() => document.body.textContent);

    expect(text).toContain("./a.js");
    expect(text).not.toContain("./b.js");
  });

  it("paginates multiple problems with a counter", async () => {
    hotApp = await createHotApp({
      // try/catch: the emitted modules re-throw their parse error at require
      // time, and an uncaught throw would add a third, runtime-error problem.
      code: `
        try {
          require("./a");
        } catch (err) {
          // expected
        }
        try {
          require("./b");
        } catch (err) {
          // expected
        }
      `,
      files: {
        "a.js": "broken a {{{",
        "b.js": "broken b {{{",
      },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);

    const frame = await waitForOverlay(page);

    // Both errors also reach the console, joined into a single error call —
    // snapshotted once the second one's code frame is in.
    await console_.waitFor("> broken b");
    expect(normalizeConsole(console_.messages)).toMatchSnapshot();

    // One problem at a time, with a counter.
    await frame.waitForFunction(() =>
      document.body.textContent.includes("1 / 2"),
    );

    await frame.click('[aria-label="Next problem"]');
    await frame.waitForFunction(() =>
      document.body.textContent.includes("2 / 2"),
    );

    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "2 / 2",
    );
  });

  it("does not appear when overlay=false", async () => {
    hotApp = await createHotApp({ query: "?overlay=false", code: app("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);

    hotApp.edit("broken again {{{");
    // The problem still reaches the console — just not the DOM.
    await console_.waitFor("Module parse failed");

    expect(await page.$(`#${OVERLAY_ID}`)).toBeNull();
  });
});
