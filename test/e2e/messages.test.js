import path from "node:path";

import collectConsole from "../helpers/console-collector";
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

  // A server applying a policy of its own — webpack-dev-server's
  // `allowedHosts` is the one this exists for — refuses a client and has the
  // only explanation for it. Without somewhere to put that, the connection
  // closes with the reason nowhere the developer is looking.
  it("logs what the server said when it refused a client", async () => {
    hotApp = await createHotApp({ code: recordingApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    hotApp.instance.publish({
      action: "error",
      message: "Invalid Host/Origin header",
    });

    await console_.waitFor("Invalid Host/Origin header");

    expect(console_.messages.join("\n")).toContain(
      "Invalid Host/Origin header",
    );

    // Posted to the page as well, so tooling watching the stream sees it too —
    // with the reason, not only the name of the message.
    await page.waitForFunction(
      () =>
        (globalThis.posted || []).some(
          (message) => message && message.type === "webpackError",
        ),
      { timeout: 30000 },
    );

    const postedError = await page.evaluate(() =>
      (globalThis.posted || []).find(
        (message) => message && message.type === "webpackError",
      ),
    );

    expect(postedError.data).toBe("Invalid Host/Origin header");
  });

  // A server that refuses a client without saying why still gets it told: the
  // console says so, and the page is posted what the console said rather than
  // nothing.
  it("tells the page what it logged when the server gave no reason", async () => {
    hotApp = await createHotApp({ code: recordingApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    hotApp.instance.publish({ action: "error" });

    await console_.waitFor("The server refused the connection.");
    await page.waitForFunction(
      () =>
        (globalThis.posted || []).some(
          (message) => message && message.type === "webpackError",
        ),
      { timeout: 30000 },
    );

    const postedError = await page.evaluate(() =>
      (globalThis.posted || []).find(
        (message) => message && message.type === "webpackError",
      ),
    );

    expect(postedError.data).toBe("The server refused the connection.");
  });

  // A package embedding this runtime is the one the developer installed and
  // the one they would report a problem to, so it labels the console with its
  // own name — the same reason the overlay's element id is settable.
  it("labels the console with the name it was given", async () => {
    hotApp = await createHotApp({
      bare: true,
      hot: { client: { logging: { level: "info", name: "my-dev-server" } } },
      code: recordingApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    const said = console_.messages.join("\n");

    expect(said).toContain("[my-dev-server]");
    expect(said).not.toContain("[webpack-dev-middleware]");
  });

  // Whitespace before the json, which a query can carry and a check on the
  // first character would miss — the object would be read as the level, and
  // the name silently lost.
  it("reads the name whatever the json is padded with", async () => {
    hotApp = await createHotApp({
      query: `?logging=${encodeURIComponent(' {"level":"info","name":"padded-server"} ')}`,
      code: recordingApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    expect(console_.messages.join("\n")).toContain("[padded-server]");
  });

  // Both cases above use `"info"`, the default — so neither would notice the
  // object's `name` being applied while its `level` was dropped. `"warn"`
  // silences `connected`, which is logged at info, and leaves a warning
  // through: the level has to be read from inside the object for this to hold.
  it("applies the level from inside the object too", async () => {
    hotApp = await createHotApp({
      bare: true,
      hot: { client: { logging: { level: "warn", name: "quiet-server" } } },
      code: recordingApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    // Logged at the error level, which `"warn"` lets through.
    hotApp.instance.publish({ action: "error", message: "a warning level" });
    await console_.waitFor("a warning level");

    const said = console_.messages.join("\n");

    expect(said).toContain("[quiet-server]");
    // Logged at info, so `"warn"` has to have come from inside the object.
    expect(said).not.toContain("connected");
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

// `webpack-dev-server/client/index.js` is a module of its own that re-exports
// this package's client, so a developer who wrote it into `entry` with a query
// has written the query on the stand-in. The client has to find it there.
describe("a module standing in for the client (browser)", () => {
  let hotApp;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
  });

  it("reads the query that was written on the stand-in", async () => {
    const client = JSON.stringify(
      path.resolve(__dirname, "../../client-src/index.js"),
    );

    hotApp = await createHotApp({
      bare: true,
      hot: { inject: false, path: "/stand-in-hmr" },
      files: {
        "stand-in.js": `
          globalThis.__webpack_dev_middleware_client_query__ = "?path=/stand-in-hmr";
          module.exports = require(${client});
        `,
      },
      code: `
        require("./stand-in.js");
        ${acceptedApp("v1")}
      `,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    // The default endpoint is somewhere else, so this connects only if the
    // path written on the stand-in was the one used.
    await console_.waitFor("connected");

    expect(console_.messages.join("\n")).toContain("connected");
    // Left for one load only: a client loaded after it must not be configured
    // by a stand-in that was never meant for it.
    expect(
      await page.evaluate(
        () => globalThis.__webpack_dev_middleware_client_query__,
      ),
    ).toBeUndefined();
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
