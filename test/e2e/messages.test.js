import {
  acceptedApp,
  boomApp,
  closeE2e,
  waitForAppText,
  waitForOverlay,
  waitForRuntimeListeners,
} from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

/**
 * An app that records everything the client posts to the page, so the test can
 * read it back. Registered from the app entry, which webpack runs after the
 * client entry — every message of interest arrives later than that, once the
 * transport has connected.
 * @param {string} text app text
 * @returns {string} fixture source
 */
function recordingApp(text) {
  // The recorder has to outlive the module: this entry accepts its own
  // updates, so it re-executes on every hot update and would otherwise throw
  // away everything posted before the one being tested.
  return `
    if (!globalThis.posted) {
      globalThis.posted = [];
      window.addEventListener("message", (event) => {
        globalThis.posted.push(event.data);
      });
    }
    ${acceptedApp(text)}
  `;
}

/**
 * @param {import("puppeteer").Page} page page
 * @returns {Promise<string[]>} the `type` of every posted message, in order
 */
function postedTypes(page) {
  return page.evaluate(() =>
    (globalThis.posted || []).map((message) =>
      typeof message === "string" ? message : message && message.type,
    ),
  );
}

describe("messages posted to the page (browser)", () => {
  let hotApp;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
  });

  it("announces a build the way webpack-dev-server's client does", async () => {
    hotApp = await createHotApp({ code: recordingApp("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    // The catch-up sync a newly connected client is sent reports a
    // compilation that had nothing to say.
    await page.waitForFunction(
      () =>
        (globalThis.posted || []).some(
          (message) => message && message.type === "webpackStillOk",
        ),
      { timeout: 30000 },
    );

    hotApp.edit(recordingApp("v2"));
    await waitForAppText(page, "v2");

    const types = await postedTypes(page);

    // A rebuild starting, then the successful result, then the hash the
    // update is being applied from — the names and the order plugins have
    // always consumed.
    expect(types).toContain("webpackInvalid");
    expect(types).toContain("webpackOk");
    expect(types.some((type) => /^webpackHotUpdate[\da-f]+$/.test(type))).toBe(
      true,
    );
    expect(types.indexOf("webpackInvalid")).toBeLessThan(
      types.indexOf("webpackOk"),
    );
  });

  it("carries the problems a build reported", async () => {
    hotApp = await createHotApp({ code: recordingApp("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    hotApp.edit("this is not valid javascript {{{");
    await waitForOverlay(page);

    // Not just the name: a consumer reads the messages off the payload.
    const errors = await page.evaluate(() => {
      const message = (globalThis.posted || []).find(
        (posted) => posted && posted.type === "webpackErrors",
      );

      return message ? message.data : null;
    });

    expect(Array.isArray(errors)).toBe(true);
    expect(errors.join("\n")).toContain("Module parse failed");
  });

  it("says when the connection went away, once per outage", async () => {
    hotApp = await createHotApp({
      query: "?timeout=1000",
      code: recordingApp("v1"),
      hot: { heartbeat: 300 },
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await page.waitForFunction(
      () =>
        (globalThis.posted || []).some(
          (message) => message && message.type === "webpackStillOk",
        ),
      { timeout: 30000 },
    );

    await hotApp.stopHttp();

    await page.waitForFunction(
      () =>
        (globalThis.posted || []).some(
          (message) => message && message.type === "webpackClose",
        ),
      { timeout: 30000 },
    );

    // Server-Sent Events retry for as long as the page is open, so a closed
    // server would keep announcing itself if this counted attempts rather
    // than outages.
    await new Promise((resolve) => {
      setTimeout(resolve, 3000);
    });

    const closes = (await postedTypes(page)).filter(
      (type) => type === "webpackClose",
    );

    expect(closes).toHaveLength(1);

    await hotApp.startHttp();
  });
});

describe("runtime error filtering (browser)", () => {
  let hotApp;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
  });

  it("gives a filter the rejected value through `cause`", async () => {
    hotApp = await createHotApp({
      // Rejects with a plain object rather than an `Error`, so the only way to
      // reach what it carries is `cause` on the error the overlay built.
      query: `?${new URLSearchParams({
        overlay: JSON.stringify({
          runtimeErrors: encodeURIComponent(
            "function(error){return Boolean(error.cause) && error.cause.status === 503}",
          ),
        }),
      })}`,
      code: `
        ${boomApp("v1")}
        globalThis.rejectWith = (value) => {
          setTimeout(() => {
            Promise.reject(value);
          }, 0);
        };
      `,
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await waitForRuntimeListeners(page);

    // A status the filter rejects: nothing appears.
    await page.evaluate(() => globalThis.rejectWith({ status: 500 }));
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    expect(await page.$("#webpack-dev-middleware-hot-overlay")).toBeNull();

    // The one it accepts, read from the same place.
    await page.evaluate(() => globalThis.rejectWith({ status: 503 }));
    await waitForOverlay(page);
  });
});
