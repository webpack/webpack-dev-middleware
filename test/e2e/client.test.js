import collectConsole, { normalizeConsole } from "../helpers/console-collector";
import {
  OVERLAY_ID,
  acceptedApp,
  boomApp,
  closeE2e,
  unacceptedApp,
  waitForAppText,
  waitForNoOverlay,
  waitForOverlay,
  waitForRuntimeListeners,
  warningApp,
} from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser, { runPage } from "../helpers/run-browser";

jest.setTimeout(400000);

const CLIENT_ENTRY = require.resolve("../../client-src/index.js");

/**
 * Plant a marker that survives HMR but not a navigation.
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

describe("hot client (browser)", () => {
  let app;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app } = await closeE2e(browser, app));
  });

  it("connects and applies an update without reloading the page", async () => {
    app = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    await plantReloadMarker(page);

    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(await readReloadMarker(page)).toBe(true);
  });

  it("broadcasts one build to every connected page", async () => {
    app = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const pageTwo = await runPage(browser);
    const consoleOne = collectConsole(page);
    const consoleTwo = collectConsole(pageTwo);

    await page.goto(app.url);
    await pageTwo.goto(app.url);
    await waitForAppText(page, "v1");
    await waitForAppText(pageTwo, "v1");
    // Both pages must be attached before the build, so what they receive is
    // the broadcast — not their own catch-up sync.
    await consoleOne.waitFor("connected");
    await consoleTwo.waitFor("connected");

    // One edit, one published build — every connected page applies it.
    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");
    await waitForAppText(pageTwo, "v2");

    expect(
      await pageTwo.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v2");
  });

  it("falls back to a full reload when the update is not accepted", async () => {
    app = await createHotApp({ code: unacceptedApp("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(unacceptedApp("v2"));

    // The reload wipes the marker and the new code renders.
    await waitForAppText(page, "v2");
    expect(await readReloadMarker(page)).toBeUndefined();
  });

  // Every boolean on the query turns off on `false` and is left alone by
  // anything else. `autoConnect` read `=== "true"` instead, so a value it did
  // not recognise turned it off — and since the default is on, turning it off
  // is the only thing anyone writes it for.
  it("stays connected for an autoConnect value that is not `false`", async () => {
    app = await createHotApp({
      query: "?autoConnect=1",
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    // Connected, so a build reaches the page.
    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v2");
    expect(console_.messages.join("\n")).toContain("connected");
  });

  it("does not connect when autoConnect is `false`", async () => {
    app = await createHotApp({
      query: "?autoConnect=false",
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");

    expect(console_.messages.join("\n")).not.toContain("connected");
  });

  it("warns instead of reloading when reload=false", async () => {
    app = await createHotApp({
      query: "?apply=hmr-only",
      code: unacceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    app.edit(unacceptedApp("v2"));
    await console_.waitFor("couldn't be hot updated");

    // Old code keeps running and the page did not reload.
    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v1");
    expect(await readReloadMarker(page)).toBe(true);
  });

  it("reconnects after a server restart and syncs up on missed builds", async () => {
    app = await createHotApp({
      query: "?connect=%7B%22timeout%22%3A1000%7D",
      code: acceptedApp("v1"),
      // Heartbeats faster than the shortened timeout, so the inactivity
      // watchdog does not churn disconnect/reconnect cycles mid-test.
      hot: { heartbeat: 300 },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");
    await plantReloadMarker(page);

    // Rebuild while the server is down — the client must pick the update up
    // through the catch-up sync after it reconnects.
    await app.stopHttp();
    const rebuilt = app.nextBuild();
    app.edit(acceptedApp("v2"));
    await rebuilt;
    await app.startHttp();

    await waitForAppText(page, "v2");
    expect(await readReloadMarker(page)).toBe(true);

    // The whole story in one place: connect, silent gap while the server was
    // down, reconnect, and the catch-up sync applying the missed build.
    await console_.waitFor("App is up to date");
    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  // The counterpart of `connected`, and what webpack-dev-server's client has
  // always printed. Said once per outage rather than once per failed attempt:
  // Server-Sent Events keep retrying for as long as the page is open, and a
  // line per retry would bury everything else.
  it("says when the connection goes away, once per outage", async () => {
    app = await createHotApp({
      query: "?connect=%7B%22timeout%22%3A500%7D",
      code: acceptedApp("v1"),
      hot: { heartbeat: 200 },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    await app.stopHttp();
    await console_.waitFor("Disconnected!");

    // Several failed retries' worth of time, so a line per attempt would show.
    await new Promise((resolve) => {
      setTimeout(resolve, 2500);
    });

    expect(
      console_.messages.filter((message) => message.includes("Disconnected!")),
    ).toHaveLength(1);

    await app.startHttp();
  });

  // What the server last said about the build is stale once the server is
  // gone: an overlay left up keeps showing errors nothing can fix from here.
  // It comes back by itself when the connection does, because a reconnection
  // is caught up on whatever is still wrong.
  it("takes a build error out of the overlay while disconnected, and restores it", async () => {
    app = await createHotApp({
      query: "?connect=%7B%22timeout%22%3A500%7D",
      code: acceptedApp("v1"),
      hot: { heartbeat: 200 },
    });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForAppText(page, "v1");

    app.edit("broken before the server goes away {{{");
    await waitForOverlay(page);

    await app.stopHttp();
    await waitForNoOverlay(page);

    expect(await page.$(`#${OVERLAY_ID}`)).toBeNull();

    await app.startHttp();

    // Still broken, so it is reported again rather than staying forgotten.
    await waitForOverlay(page);

    expect(await page.$(`#${OVERLAY_ID}`)).not.toBeNull();
  });

  // The other half of the same rule. A lost connection says nothing about an
  // error the page threw on its own, so dropping that along with the build
  // problems would hide something that is still true.
  it("keeps a runtime error in the overlay when the connection goes away", async () => {
    app = await createHotApp({
      query: "?connect=%7B%22timeout%22%3A500%7D",
      code: boomApp("v1"),
      hot: { heartbeat: 200 },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await waitForRuntimeListeners(page);

    await page.evaluate(() => globalThis.boom("the page's own mistake"));
    await waitForOverlay(page);

    await app.stopHttp();
    await console_.waitFor("Disconnected!");
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    expect(await page.$(`#${OVERLAY_ID}`)).not.toBeNull();

    await app.startHttp();
  });

  it("watchdog-reconnects a silent connection and stays armed afterwards", async () => {
    app = await createHotApp({
      query: "?connect=%7B%22timeout%22%3A1000%7D",
      code: acceptedApp("v1"),
      // A heartbeat far beyond the client timeout leaves the connection open
      // but silent, so only the inactivity watchdog can trigger reconnects.
      hot: { heartbeat: 3600000 },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");

    // Three connects = the initial one plus two watchdog cycles: the second
    // proves the watchdog fires on pure silence (no error event involved),
    // the third that it re-arms after a reconnect instead of dying with the
    // first clearInterval.
    await console_.waitForCount("connected", 3);

    // Each silent cycle is an outage, so it reads connected → Disconnected! →
    // connected, and nothing else: no error event, no retry noise. Three
    // connects have two drops between them, which is five lines. The watchdog
    // keeps cycling, so only those are pinned — a fourth drop may already have
    // landed.
    expect(normalizeConsole(console_.messages).slice(0, 5)).toMatchSnapshot();

    // The reconnected connection still delivers updates.
    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v2");
  });

  // The same watchdog, with the object set on the middleware instead of
  // written into the query by hand. Everything between the two is new ground:
  // an object option is serialized for the entry query, and `String(value)`
  // there would hand the client `"[object Object]"` — which fails to parse,
  // is read as the boolean `true`, and so connects with the default timeout
  // rather than this one. The watchdog never firing is how that looks.
  it("takes a connect object set on the middleware", async () => {
    app = await createHotApp({
      bare: true,
      hot: { heartbeat: 3600000, client: { connect: { timeout: 1000 } } },
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");

    // Three connects inside the test's own timeout only happens on a 1000ms
    // watchdog; on the 20000ms default this waits until the suite gives up.
    await console_.waitForCount("connected", 3);

    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v2");
  });

  it("reconnects manually with setOptionsAndConnect() after disconnect()", async () => {
    app = await createHotApp({
      code: `
        globalThis.hotClient = require(${JSON.stringify(CLIENT_ENTRY)});
        document.getElementById("app").textContent = "v1";
        if (module.hot) {
          module.hot.accept();
        }
      `,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    // disconnect() drops the cached wrapper, so a manual connect starts a
    // fresh connection on the same path.
    await page.evaluate(() => {
      globalThis.hotClient.disconnect();
      globalThis.hotClient.setOptionsAndConnect({});
    });
    await console_.waitForCount("connected", 2);

    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");
    await console_.waitFor("App is up to date");

    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  it("connects once for a path already subscribed to", async () => {
    app = await createHotApp({
      code: `
        globalThis.hotClient = require(${JSON.stringify(CLIENT_ENTRY)});
        document.getElementById("app").textContent = "v1";
        if (module.hot) {
          module.hot.accept();
        }
      `,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    // The automatic connect already subscribed this path. Calling again must
    // not add a second listener, or every message would be handled twice.
    await page.evaluate(() => {
      globalThis.hotClient.setOptionsAndConnect({});
      globalThis.hotClient.setOptionsAndConnect({});
    });

    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");
    await console_.waitFor("App is up to date");

    expect(
      console_.messages.filter((text) => text.includes("App is up to date")),
    ).toHaveLength(1);
  });

  it("hands problems to a custom overlay instead of its own", async () => {
    app = await createHotApp({
      code: `
        globalThis.hotClient = require(${JSON.stringify(CLIENT_ENTRY)});
        globalThis.customOverlayCalls = [];
        globalThis.hotClient.useCustomOverlay({
          showProblems: (type, problems) =>
            globalThis.customOverlayCalls.push({
              method: "showProblems",
              type,
              problems,
            }),
          clear: (scope) =>
            globalThis.customOverlayCalls.push({ method: "clear", scope }),
        });
        document.getElementById("app").textContent = "v1";
        if (module.hot) {
          module.hot.accept();
        }
      `,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    app.edit("this is not valid javascript {{{");
    await console_.waitFor("has 1 errors");

    // The client's own overlay stays out of the DOM: the host took over.
    expect(
      await page.evaluate(
        (id) => document.getElementById(id) === null,
        OVERLAY_ID,
      ),
    ).toBe(true);
    // Specifically `showProblems` with the errors: a `clear` call would
    // satisfy a bare length check without the build error ever reaching the
    // host's overlay.
    expect(
      await page.evaluate(() =>
        globalThis.customOverlayCalls.find(
          ({ method }) => method === "showProblems",
        ),
      ),
    ).toMatchObject({ type: "errors" });
  });

  it("rebuilds on instance.invalidate() and syncs connected pages as a no-op", async () => {
    app = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");
    await plantReloadMarker(page);

    // A server-side invalidate with unchanged sources: the rebuild reaches
    // the browser, and its unchanged hash arrives as a sync the client
    // applies as a no-op (a `built` here would 404 on the missing manifest).
    const rebuilt = app.nextBuild();
    app.instance.invalidate();
    await rebuilt;
    await console_.waitFor("bundle rebuilding");

    // Give the sync a beat to land before pinning that nothing changed.
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    // Two lines only: no file on the building event (nothing triggered it)
    // and a sync so uneventful it does not even log.
    expect(normalizeConsole(console_.messages)).toMatchSnapshot();

    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v1");
    expect(await readReloadMarker(page)).toBe(true);
  });

  it("keeps the page alive after instance.close()", async () => {
    app = await createHotApp({
      query: "?connect=%7B%22timeout%22%3A1000%7D",
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");
    await plantReloadMarker(page);

    // Closing the middleware ends the SSE stream; the client falls into its
    // reconnect loop against an endpoint that no longer speaks SSE.
    await new Promise((resolve) => {
      app.instance.close(resolve);
    });

    // A few reconnect windows later the page is still running untouched.
    await new Promise((resolve) => {
      setTimeout(resolve, 2500);
    });

    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v1");
    expect(await readReloadMarker(page)).toBe(true);
  });

  it("applies updates that carry warnings", async () => {
    app = await createHotApp({ code: warningApp("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await plantReloadMarker(page);

    // Warnings do not block HMR: the update lands without a reload.
    app.edit(warningApp("v2"));
    await waitForAppText(page, "v2");

    expect(await readReloadMarker(page)).toBe(true);
  });

  it("builds the SSE url from the runtime public path, slashes intact", async () => {
    app = await createHotApp({
      query: "?connect=false",
      code: `
        globalThis.hotClient = require(${JSON.stringify(CLIENT_ENTRY)});
        globalThis.setPublicPath = (value) => {
          __webpack_public_path__ = value;
        };
        document.getElementById("app").textContent = "v1";
      `,
    });
    ({ page, browser } = await runBrowser());

    /** @type {string[]} */
    const requested = [];
    page.on("request", (request) => {
      requested.push(request.url());
    });

    await page.goto(app.url);
    await waitForAppText(page, "v1");

    // The runtime public path is picked up at connect time — intentional
    // double slashes survive, a trailing slash does not double up.
    await page.evaluate(() => {
      globalThis.setPublicPath("https://host//rewritten/");
      globalThis.hotClient.setOptionsAndConnect({
        dynamicPublicPath: "true",
        path: "/__webpack_hmr",
      });
    });
    await page.evaluate(() => {
      globalThis.setPublicPath("https://localhost:3000/assets/");
      globalThis.hotClient.setOptionsAndConnect({
        dynamicPublicPath: "true",
        path: "/__webpack_hmr",
      });
    });

    const start = Date.now();
    while (
      Date.now() - start < 30000 &&
      !(
        requested.includes("https://host//rewritten/__webpack_hmr") &&
        requested.includes("https://localhost:3000/assets/__webpack_hmr")
      )
    ) {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }

    expect(requested).toContain("https://host//rewritten/__webpack_hmr");
    expect(requested).toContain("https://localhost:3000/assets/__webpack_hmr");
  });

  it("warns and stays connectionless without EventSource support", async () => {
    app = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.evaluateOnNewDocument(() => {
      delete globalThis.EventSource;
    });
    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("requires EventSource");

    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  it("connects through a dynamic public path", async () => {
    app = await createHotApp({
      publicPath: "/assets/",
      hot: { path: "/assets/__webpack_hmr" },
      query: "?dynamicPublicPath=true&path=/__webpack_hmr",
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    // __webpack_public_path__ ("/assets/") + the path option's basename.
    await console_.waitFor("connected");
    await plantReloadMarker(page);

    app.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(await readReloadMarker(page)).toBe(true);
  });

  it("keeps heartbeats away from subscribers and the console", async () => {
    app = await createHotApp({
      hot: { heartbeat: 100 },
      code: `
        const hotClient = require(${JSON.stringify(CLIENT_ENTRY)});
        globalThis.__all = [];
        hotClient.subscribeAll((payload) => {
          globalThis.__all.push(payload.action);
        });
        document.getElementById("app").textContent = "v1";
        if (module.hot) {
          module.hot.accept();
        }
      `,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    // Several heartbeat periods pass...
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    // ...and none of them reached the subscribers (only the catch-up sync
    // did) or the console.
    expect(await page.evaluate(() => globalThis.__all)).toEqual(["sync"]);
    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
  });

  it("warns on malformed frames without breaking the page", async () => {
    app = await createHotApp({
      query: "?path=/__fake_hmr",
      code: acceptedApp("v1"),
      // A rogue SSE endpoint feeding the real EventSource a non-JSON frame.
      setup: (server) => {
        server.get("/__fake_hmr", (_req, res) => {
          res.writeHead(200, { "Content-Type": "text/event-stream" });
          res.write("\n");
          res.write("data: not-json{\n\n");
        });
      },
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("Invalid HMR message");

    expect(normalizeConsole(console_.messages)).toMatchSnapshot();
    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v1");
  });

  it("routes server publish() payloads to subscribe handlers", async () => {
    app = await createHotApp({
      code: `
        const hotClient = require(${JSON.stringify(CLIENT_ENTRY)});
        globalThis.__all = [];
        hotClient.subscribeAll((payload) => {
          globalThis.__all.push(payload.action);
        });
        hotClient.subscribe((payload) => {
          globalThis.__custom = payload;
        });
        document.getElementById("app").textContent = "v1";
        if (module.hot) {
          module.hot.accept();
        }
      `,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    // The documented custom-events API: server-side publish, client-side
    // subscribe for payloads whose action the client does not recognise.
    app.instance.context.hot.publish({ action: "my-event", value: 42 });

    await page.waitForFunction(
      () => globalThis.__custom && globalThis.__custom.value === 42,
      { timeout: 30000 },
    );
    expect(await page.evaluate(() => globalThis.__custom.action)).toBe(
      "my-event",
    );

    // subscribeAll saw both the protocol traffic (the connect-time sync) and
    // the custom payload; subscribe saw only the custom one.
    const all = await page.evaluate(() => globalThis.__all);

    expect(all).toContain("sync");
    expect(all).toContain("my-event");
  });

  it("disconnect() during the reconnect window cancels the pending reconnect", async () => {
    app = await createHotApp({
      query: "?connect=%7B%22timeout%22%3A1000%7D",
      hot: { heartbeat: 300 },
      code: `
        globalThis.hotClient = require(${JSON.stringify(CLIENT_ENTRY)});
        document.getElementById("app").textContent = "v1";
        if (module.hot) {
          module.hot.accept();
        }
      `,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await console_.waitFor("connected");

    // Sever the connection (a reconnect gets scheduled ~1s out), disconnect
    // inside that window, then bring the server back.
    await app.stopHttp();
    await page.evaluate(() => globalThis.hotClient.disconnect());
    await app.startHttp();

    const rebuilt = app.nextBuild();
    app.edit(acceptedApp("v2"));
    await rebuilt;

    // Enough time for the cancelled reconnect to have fired if it survived.
    await new Promise((resolve) => {
      setTimeout(resolve, 3000);
    });

    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v1");
  });

  it("disconnect() closes the connection and stops receiving updates", async () => {
    app = await createHotApp({
      code: `
        globalThis.hotClient = require(${JSON.stringify(CLIENT_ENTRY)});
        document.getElementById("app").textContent = "v1";
        if (module.hot) {
          module.hot.accept();
        }
      `,
    });
    ({ page, browser } = await runBrowser());
    const console_ = collectConsole(page);

    await page.goto(app.url);
    await waitForAppText(page, "v1");
    await console_.waitFor("connected");

    await page.evaluate(() => globalThis.hotClient.disconnect());

    const rebuilt = app.nextBuild();
    app.edit(acceptedApp("v2"));
    await rebuilt;

    // Grace period: were the connection still alive, the update would land
    // well within it.
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });

    expect(
      await page.evaluate(() => document.getElementById("app").textContent),
    ).toBe("v1");
  });
});
