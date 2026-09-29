import collectConsole from "../helpers/console-collector";
import { acceptedApp, closeE2e, waitForAppText } from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

// Long enough for a build to finish and a reload to have happened, so a page
// that is still showing the old code is one that was left alone rather than
// one that has not caught up yet.
const SETTLE = 4000;

/**
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

/**
 * @param {import("puppeteer").Page} page page
 * @returns {Promise<string>} what the app is currently rendering
 */
function appText(page) {
  return page.evaluate(() => document.getElementById("app").textContent);
}

/**
 * @returns {Promise<void>} resolved once a build and a reload would have run
 */
function settle() {
  return new Promise((resolve) => {
    setTimeout(resolve, SETTLE);
  });
}

// Without Hot Module Replacement a rebuild can only reach the page by loading
// it again. These run with no `HotModuleReplacementPlugin` at all, so nothing
// here can be HMR quietly doing the work.
describe("live reload (browser)", () => {
  let app;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app } = await closeE2e(browser, app));
  });

  it("reloads the page on a build when hot is off", async () => {
    app = await createHotApp({
      query: "?hot=false",
      hmrPlugin: false,
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    // The marker is gone, so the new code arrived by loading the page again
    // rather than through an update.
    expect(await readReloadMarker(page)).toBeUndefined();
  });

  it("leaves the page alone when live reload is off as well", async () => {
    app = await createHotApp({
      query: "?hot=false&live-reload=false",
      hmrPlugin: false,
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(acceptedApp("v2"));
    await settle();

    expect(await appText(page)).toBe("v1");
    expect(await readReloadMarker(page)).toBe(true);
  });

  it("takes the camel-cased spelling as well", async () => {
    // Both spellings are accepted: `live-reload` is what webpack-dev-server's
    // entry query has always used, and `liveReload` is what an option set on
    // the middleware in node serializes to.
    app = await createHotApp({
      query: "?hot=false&liveReload=false",
      hmrPlugin: false,
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(acceptedApp("v2"));
    await settle();

    expect(await appText(page)).toBe("v1");
    expect(await readReloadMarker(page)).toBe(true);
  });

  it("does not reload for a build that changed nothing", async () => {
    app = await createHotApp({
      query: "?hot=false",
      hmrPlugin: false,
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    // Rebuilds without touching a file: the bundle's hash is unchanged, so
    // this is a `sync`, which reports what the page is already running.
    await new Promise((resolve) => {
      app.instance.invalidate(resolve);
    });
    await settle();

    expect(await readReloadMarker(page)).toBe(true);
  });

  it("lets one page opt out through its own url", async () => {
    app = await createHotApp({
      query: "?hot=false",
      hmrPlugin: false,
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());

    await page.goto(
      `${app.url}?webpack-dev-middleware-live-reload=false`.replace(
        /\/\?/,
        "/?",
      ),
    );
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(acceptedApp("v2"));
    await settle();

    // Everything else still reloads; this tab asked not to.
    expect(await appText(page)).toBe("v1");
    expect(await readReloadMarker(page)).toBe(true);
  });

  it("reads the parameter, not the text of the url", async () => {
    app = await createHotApp({
      query: "?hot=false",
      hmrPlugin: false,
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());

    // Both halves of the url say the words without saying the thing: the
    // first carries them inside another parameter's value, and the second is
    // the parameter but with a value that only begins with "false".
    await page.goto(
      `${app.url}?note=webpack-dev-middleware-live-reload=false&webpack-dev-middleware-live-reload=falsehood`,
    );
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    // Neither turned anything off, so the page reloaded as it should.
    expect(await readReloadMarker(page)).toBeUndefined();
  });

  it("matches a prefix with capitals in it", async () => {
    app = await createHotApp({
      query: "?hot=false&urlPrefix=MyServer",
      hmrPlugin: false,
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());

    await page.goto(`${app.url}?MyServer-live-reload=false`);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(acceptedApp("v2"));
    await settle();

    expect(await appText(page)).toBe("v1");
    expect(await readReloadMarker(page)).toBe(true);
  });

  it("turns a page's hot updates into a reload through its own url", async () => {
    // The plugin is there and the client would hot update, but this page said
    // not to — so the build reaches it the only other way.
    app = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(`${app.url}?webpack-dev-middleware-hot=false`);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(await readReloadMarker(page)).toBeUndefined();
  });

  it("names those url parameters after whoever is serving", async () => {
    app = await createHotApp({
      query: "?hot=false&urlPrefix=my-server",
      hmrPlugin: false,
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());

    await page.goto(`${app.url}?my-server-live-reload=false`);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(acceptedApp("v2"));
    await settle();

    expect(await appText(page)).toBe("v1");
    expect(await readReloadMarker(page)).toBe(true);
  });

  it("reloads when the server asks, whatever the build settings say", async () => {
    app = await createHotApp({
      // Neither mechanism would reload this page on a build.
      query: "?hot=false&live-reload=false",
      hmrPlugin: false,
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");
    await plantReloadMarker(page);

    // What a server watching files of its own would publish — nothing here
    // came from a compilation.
    app.instance.context.hot.publish({
      action: "reload",
      file: "static/index.html",
    });

    await page.waitForFunction(() => globalThis.__notReloaded === undefined, {
      polling: 100,
      timeout: 30000,
    });

    expect(console_.messages.join("\n")).toContain(
      '"static/index.html" changed. Reloading...',
    );
  });
});
