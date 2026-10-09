import collectConsole from "../helpers/console-collector";
import {
  INDICATOR_ID,
  OVERLAY_ID,
  acceptedApp,
  closeE2e,
  unacceptedApp,
  waitForAppText,
  waitForNoOverlay,
  waitForOverlay,
  waitForOverlayText,
  warningApp,
} from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

// What webpack-dev-server's own client did, which a page running this one in
// its place still expects: that server ships this runtime now, so each of
// these is a regression for its users if it goes.
describe("what webpack-dev-server's client did (browser)", () => {
  let hotApp;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
  });

  it("keeps applying updates on a page whose url has a malformed escape", async () => {
    // A browser leaves `50%` as it is, and the runtime reads the page's url on
    // every build — one bad parameter must not stop every update.
    hotApp = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(`${hotApp.url}?discount=50%`);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(console_.messages.join("\n")).not.toContain("Invalid HMR message");
  });

  it("reloads a live-reload page that reconnects to a newer build", async () => {
    // Rebuilt while the server is down, so the only thing that can bring the
    // new code is the catch-up a reconnected page is sent — which a page
    // without Hot Module Replacement has to load itself again for.
    hotApp = await createHotApp({
      query: "?apply=reload&timeout=1000",
      code: unacceptedApp("v1"),
      hot: { heartbeat: 300 },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    await hotApp.stopHttp();

    const rebuilt = hotApp.nextBuild();

    hotApp.edit(unacceptedApp("v2"));
    await rebuilt;
    await hotApp.startHttp();

    await waitForAppText(page, "v2");

    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v2");
  });

  it("does not reload a live-reload page that reconnects to the build it runs", async () => {
    hotApp = await createHotApp({
      query: "?apply=reload&timeout=1000",
      code: unacceptedApp("v1"),
      hot: { heartbeat: 300 },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    await page.evaluate(() => {
      globalThis.notReloaded = true;
    });

    // `] connected` rather than `connected`, which "Disconnected!" contains.
    const before = console_.messages.filter((text) =>
      text.includes("] connected"),
    ).length;

    await hotApp.stopHttp();
    await hotApp.startHttp();

    // Connected again, and caught up on a build the page already has.
    await console_.waitForCount("] connected", before + 1);

    expect(await page.evaluate(() => globalThis.notReloaded)).toBe(true);
  });

  it("reports a build's warnings as well as its errors", async () => {
    hotApp = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await page.evaluate(() => {
      globalThis.posted = [];
      window.addEventListener("message", (event) => {
        if (event.data && typeof event.data.type === "string") {
          globalThis.posted.push(event.data.type);
        }
      });
    });

    // Webpack's "Critical dependency" warning, and a module that is not there.
    hotApp.edit(`${warningApp("v2")}\nrequire("./not-there");`);
    await page.waitForFunction(
      () => globalThis.posted.includes("webpackErrors"),
      { timeout: 30000 },
    );

    const posted = await page.evaluate(() => globalThis.posted);

    // In the order webpack-dev-server's client posted them.
    expect(posted.indexOf("webpackWarnings")).toBeGreaterThan(-1);
    expect(posted.indexOf("webpackWarnings")).toBeLessThan(
      posted.indexOf("webpackErrors"),
    );
    expect(console_.messages.join("\n")).toContain("Critical dependency");
  });

  it("connects where webpack-dev-server's query spelling says", async () => {
    // A client entry written by hand for that server: the parts of the url as
    // parameters of their own, and `live-reload` rather than `liveReload`.
    const query = new URLSearchParams({
      protocol: "ws:",
      hostname: "0.0.0.0",
      port: "0",
      pathname: "/custom-hmr",
      hot: "true",
      "live-reload": "true",
    });

    hotApp = await createHotApp({
      hot: { path: "/custom-hmr" },
      query: `?${query}`,
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(console_.messages.join("\n")).not.toContain("Invalid HMR message");
  });

  it("reads webpack-dev-server's live-reload alone as live reload", async () => {
    // That client read `hot` as off unless the query said otherwise.
    hotApp = await createHotApp({
      query: "?live-reload=true",
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");
    await page.evaluate(() => {
      globalThis.notReloaded = true;
    });

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    // Loaded again rather than updated in place, though the module accepts.
    expect(await page.evaluate(() => globalThis.notReloaded)).toBeUndefined();
  });

  it("dismisses the overlay with Escape as an older browser names it", async () => {
    hotApp = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    hotApp.edit("broken {{{");
    await waitForOverlay(page);

    // Enter is not a way out.
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });

    expect(await page.$(`#${OVERLAY_ID}`)).not.toBeNull();

    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Esc" }));
    });
    await waitForNoOverlay(page);

    expect(await page.$(`#${OVERLAY_ID}`)).toBeNull();
  });

  it("puts the overlay above everything a page can stack", async () => {
    hotApp = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    hotApp.edit("broken {{{");
    await waitForOverlay(page);

    expect(
      await page.evaluate(
        (id) => getComputedStyle(document.getElementById(id)).zIndex,
        OVERLAY_ID,
      ),
    ).toBe("2147483647");
  });

  it("shows a thrown value that is not an Error, and a rejection with a string", async () => {
    hotApp = await createHotApp({
      code: `${acceptedApp("v1")}
        globalThis.throwNull = () => setTimeout(() => { throw null; }, 0);
        globalThis.rejectWith = (reason) => Promise.reject(reason);`,
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    await page.evaluate(() => {
      globalThis.throwNull();
    });
    await waitForOverlayText(page, { includes: ["Uncaught runtime error"] });

    await page.evaluate(() => {
      globalThis.rejectWith("a string, not an Error");
    });

    expect(
      await waitForOverlayText(page, { includes: ["a string, not an Error"] }),
    ).toContain("a string, not an Error");
  });

  it("reloads when the server asks without naming a file", async () => {
    hotApp = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");
    await page.evaluate(() => {
      globalThis.notReloaded = true;
    });

    hotApp.instance.publish({ action: "reload" });

    await page.waitForFunction(() => globalThis.notReloaded === undefined, {
      timeout: 30000,
    });
    expect(console_.messages.join("\n")).toContain(
      "Reloading, as the server asked",
    );
  });

  it("announces the building indicator as a progress bar", async () => {
    hotApp = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    hotApp.instance.publish({ action: "building" });
    hotApp.instance.publish({ action: "progress", percent: 42, message: "x" });

    await page.waitForFunction(
      (id) =>
        document.getElementById(id)?.getAttribute("aria-valuenow") === "42",
      { timeout: 30000 },
      INDICATOR_ID,
    );

    expect(
      await page.evaluate(
        (id) => document.getElementById(id).getAttribute("role"),
        INDICATOR_ID,
      ),
    ).toBe("progressbar");
  });

  it("shows the building indicator in a browser without Shadow DOM", async () => {
    hotApp = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.evaluateOnNewDocument(() => {
      Element.prototype.attachShadow = undefined;
    });
    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(console_.messages.join("\n")).not.toContain("Invalid HMR message");
  });
});
