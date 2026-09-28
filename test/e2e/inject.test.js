import collectConsole from "../helpers/console-collector";
import { acceptedApp, closeE2e, waitForAppText } from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

// Everything here runs against a webpack configuration that has neither the
// client entry nor `HotModuleReplacementPlugin` — the whole of what a
// developer did was enable `hot` on the middleware. If any of it needs a
// configuration change to work, the promise this feature makes is false.
describe("hot with nothing but the middleware (browser)", () => {
  let hotApp;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
  });

  it("connects and applies an update", async () => {
    hotApp = await createHotApp({ bare: true, code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    // Survives a hot update but not a navigation, so it proves the update was
    // applied rather than the page being reloaded — which is the difference
    // between the plugin having been added and not.
    await page.evaluate(() => {
      globalThis.notReloaded = true;
    });

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(await page.evaluate(() => globalThis.notReloaded)).toBe(true);
  });

  it("shows a build error in the overlay", async () => {
    hotApp = await createHotApp({ bare: true, code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    hotApp.edit("this is not valid javascript {{{");

    const frame = await page
      .waitForSelector("#webpack-dev-middleware-hot-overlay", {
        timeout: 30000,
      })
      .then((handle) => handle.contentFrame());

    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "Module parse failed",
    );
  });

  it("leaves the compilation alone when injection is off", async () => {
    hotApp = await createHotApp({
      bare: true,
      code: acceptedApp("v1"),
      hot: { inject: false },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    // Nothing was added, so nothing connects — the escape hatch for anyone
    // wiring the entry themselves.
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });

    expect(console_.messages.join("\n")).not.toContain("connected");
  });

  it("does not add a second client when one is already an entry", async () => {
    // Not `bare`: this configuration follows the documentation as it was
    // before the middleware injected anything.
    hotApp = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    // One client, so one "connected" — a duplicated entry would say it twice.
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    expect(
      console_.messages.filter((message) => message.includes("connected")),
    ).toHaveLength(1);
  });
});
