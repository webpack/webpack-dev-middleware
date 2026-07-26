import collectConsole, { normalizeConsole } from "../helpers/console-collector";
import {
  acceptedApp,
  closeE2e,
  waitForAppText,
  warningApp,
} from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

describe("client logging (browser)", () => {
  let hotApp;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
  });

  it("logs a full update cycle at the default info level, with the prefix", async () => {
    hotApp = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");
    await console_.waitFor("App is up to date");

    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  it("logging=log adds the collapsed per-module detail", async () => {
    hotApp = await createHotApp({
      query: "?logging=log",
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");
    await console_.waitFor("App is up to date");

    // Includes the "Updated modules:" collapsed group and its " - ./app.js"
    // entry, which the info level gates off.
    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  it("logging=none silences the whole cycle", async () => {
    hotApp = await createHotApp({
      query: "?logging=none",
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    hotApp.edit(acceptedApp("v2"));
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
      code: warningApp("v1"),
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
    hotApp = await createHotApp({
      query: "?logging=error",
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    hotApp.edit("broken {{{");
    await console_.waitFor("Module parse failed");

    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });
});
