import collectConsole from "../helpers/console-collector";
import { acceptedApp, closeE2e, waitForAppText } from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

const OVERLAY_SELECTOR = "#webpack-dev-middleware-hot-overlay";

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

  it("hands the browser options to the runtime", async () => {
    hotApp = await createHotApp({
      bare: true,
      code: acceptedApp("v1"),
      // Set on the middleware, in node — the developer never touches the
      // webpack configuration or the client's query.
      hot: { client: { progress: "linear", logging: "none" } },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    await page.evaluate((id) => {
      globalThis.__shapes = [];

      const record = () => {
        const host = document.getElementById(id);

        if (host) {
          globalThis.__shapes.push(host.style.top);
        }
      };

      new MutationObserver(record).observe(document.body, {
        childList: true,
        subtree: true,
      });
      setInterval(record, 10);
    }, "webpack-dev-middleware-building-indicator");

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    // `progress: "linear"` is the bar pinned to the top, not the badge.
    expect(await page.evaluate(() => globalThis.__shapes)).toContain("0px");
    // `logging: "none"` silences the runtime, including its "connected".
    expect(console_.messages.join("\n")).not.toContain("connected");
  });

  it("gives each named compilation a client that ignores its siblings", async () => {
    hotApp = await createHotApp({
      bare: true,
      apps: [
        { name: "a", code: acceptedApp("a1") },
        { name: "b", code: acceptedApp("b1") },
      ],
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    // The page for one bundle only, so its client is the only one on it.
    await page.goto(`${hotApp.url}page/a`);
    await waitForAppText(page, "a1");

    await page.evaluate(() => {
      globalThis.notReloaded = true;
    });

    // Both compilations report to every client over the one stream, so the
    // client is told the name of its own and ignores the rest. Without it this
    // page would show a build error from code it does not contain.
    hotApp.edit("b", "this is not valid javascript {{{");

    // `b`'s build is logged before the name is looked at, so this says the
    // event reached this page — waiting on a clock would only say that time
    // passed, and could pass before a broken client had the chance to fail.
    await console_.waitFor("bundle 'b' rebuilt");

    expect(await page.$(OVERLAY_SELECTOR)).toBeNull();

    // ... and the same page does show its own, so the silence above is the
    // filter working rather than the overlay being broken.
    hotApp.edit("a", "this is not valid javascript {{{");
    await page.waitForSelector(OVERLAY_SELECTOR, { timeout: 30000 });

    expect(await page.evaluate(() => globalThis.notReloaded)).toBe(true);
  });

  it("takes the options that used to be the query's alone", async () => {
    hotApp = await createHotApp({
      bare: true,
      code: acceptedApp("v1"),
      // Neither of these could be set in node before: `hot` and `liveReload`
      // were readable from the entry query only.
      hot: { client: { apply: "nothing" } },
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await page.evaluate(() => {
      globalThis.notReloaded = true;
    });

    hotApp.edit(acceptedApp("v2"));
    await new Promise((resolve) => {
      setTimeout(resolve, 4000);
    });

    // Each half of this fails differently if the option did not arrive: with
    // `hot` still on the page would be showing "v2" with its marker intact,
    // and with `liveReload` still on it would be showing "v2" with the marker
    // gone. Only both arriving leaves the page as it is.
    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v1");
    expect(await page.evaluate(() => globalThis.notReloaded)).toBe(true);
  });

  it("names the page's opt-out parameters from node", async () => {
    hotApp = await createHotApp({
      bare: true,
      code: acceptedApp("v1"),
      // What a server built on this middleware sets so the parameters its own
      // users know keep working.
      hot: { client: { urlPrefix: "my-server" } },
    });
    ({ page, browser } = await runBrowser());

    await page.goto(`${hotApp.url}?my-server-apply=nothing`);
    await waitForAppText(page, "v1");
    await page.evaluate(() => {
      globalThis.notReloaded = true;
    });

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    // The parameter was this prefix's, so this page took the build as a
    // reload; under the default prefix it would have been an update and the
    // marker would still be there.
    expect(await page.evaluate(() => globalThis.notReloaded)).toBeUndefined();
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
