import {
  INDICATOR_ID,
  acceptedApp,
  closeE2e,
  waitForAppText,
} from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

const INDICATOR_ENTRY = require.resolve("../../client-src/indicator.js");
const INDICATOR_STATE_KEY = "__webpack_dev_middleware_hot_indicator_state__";

/**
 * Watch for the badge from inside the page — it only exists for the duration
 * of a rebuild. Presence is recorded race-free by a MutationObserver (an
 * interval could miss a sub-tick rebuild entirely); the badge text, which
 * lives in a shadow root the body observer cannot see into, is additionally
 * sampled on a fast interval.
 * @param {import("puppeteer").Page} page page
 * @returns {Promise<void>} resolved once the watcher is installed
 */
async function installBadgeSampler(page) {
  await page.evaluate((id) => {
    globalThis.__badgeSeen = false;
    globalThis.__badgeTexts = [];

    const record = () => {
      const host = document.getElementById(id);
      if (host) {
        globalThis.__badgeSeen = true;
        globalThis.__badgeTexts.push(
          host.shadowRoot ? host.shadowRoot.textContent : "",
        );
      }
    };

    new MutationObserver(record).observe(document.body, {
      childList: true,
      subtree: true,
    });
    setInterval(record, 10);
  }, INDICATOR_ID);
}

describe("building indicator (browser)", () => {
  let hotApp;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
  });

  it("shows the badge during a rebuild and removes it afterwards", async () => {
    hotApp = await createHotApp({ code: acceptedApp("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await installBadgeSampler(page);

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(await page.evaluate(() => globalThis.__badgeSeen)).toBe(true);
    // The build finished, so the badge must be gone again.
    await page.waitForFunction(
      (id) => document.getElementById(id) === null,
      { timeout: 30000 },
      INDICATOR_ID,
    );
  });

  it("shows the compilation percentage when hot.progress is enabled", async () => {
    hotApp = await createHotApp({
      code: acceptedApp("v1"),
      hot: { progress: true },
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await installBadgeSampler(page);

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    const texts = await page.evaluate(() => globalThis.__badgeTexts);

    expect(texts.some((text) => text.includes("%"))).toBe(true);
  });

  it("never appears when progress=false", async () => {
    hotApp = await createHotApp({
      query: "?progress=false",
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");
    await installBadgeSampler(page);

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    expect(await page.evaluate(() => globalThis.__badgeSeen)).toBe(false);
  });

  it("renders a bar across the top for progress=linear", async () => {
    hotApp = await createHotApp({
      query: "?progress=linear",
      code: acceptedApp("v1"),
      hot: { progress: true },
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    // Sampled from inside the page: the indicator only exists while a build
    // is running, which can be shorter than a round trip from the test.
    await page.evaluate((id) => {
      globalThis.__shapes = [];

      const record = () => {
        const host = document.getElementById(id);

        if (!host || !host.shadowRoot) {
          return;
        }

        const child = host.shadowRoot.firstElementChild;

        globalThis.__shapes.push({
          top: host.style.top,
          width: host.style.width,
          right: host.style.right,
          childWidth: child ? child.style.width : null,
        });
      };

      new MutationObserver(record).observe(document.body, {
        childList: true,
        subtree: true,
      });
      setInterval(record, 10);
    }, INDICATOR_ID);

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    const shapes = await page.evaluate(() => globalThis.__shapes);

    expect(shapes.length).toBeGreaterThan(0);
    // Pinned to the top edge and spanning the viewport, rather than the
    // badge's bottom-right corner.
    expect(shapes[0].top).toBe("0px");
    expect(shapes[0].width).toBe("100%");
    expect(shapes[0].right).toBe("");
    // A percentage arrives with the progress payloads, so the filled part is
    // measured rather than sweeping.
    expect(
      shapes.some(
        (shape) =>
          shape.childWidth &&
          shape.childWidth !== "40%" &&
          shape.childWidth.endsWith("%"),
      ),
    ).toBe(true);
  });

  it("does not sweep the bar when motion is declined", async () => {
    hotApp = await createHotApp({
      query: "?progress=linear",
      code: acceptedApp("v1"),
    });
    ({ page, browser } = await runBrowser());

    await page.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await page.goto(hotApp.url);
    await waitForAppText(page, "v1");

    await page.evaluate((id) => {
      globalThis.__animated = [];

      const record = () => {
        const host = document.getElementById(id);
        const child =
          host && host.shadowRoot && host.shadowRoot.firstElementChild;

        if (child) {
          globalThis.__animated.push({
            running: child.getAnimations
              ? child.getAnimations().length
              : "unsupported",
            width: child.style.width,
          });
        }
      };

      new MutationObserver(record).observe(document.body, {
        childList: true,
        subtree: true,
      });
      setInterval(record, 10);
    }, INDICATOR_ID);

    hotApp.edit(acceptedApp("v2"));
    await waitForAppText(page, "v2");

    const samples = await page.evaluate(() => globalThis.__animated);

    expect(samples.length).toBeGreaterThan(0);
    // Nothing moving, and the bar says a build is running by being full
    // instead of by sweeping.
    expect(samples.every((sample) => sample.running === 0)).toBe(true);
    expect(samples.some((sample) => sample.width === "100%")).toBe(true);
  });
});

describe("indicator shared state across bundled copies (browser)", () => {
  let hotApp;
  let browser;
  let page;

  /**
   * Two real bundled copies of the indicator module — one per compilation —
   * exposed as globals so the tests can drive both from the page.
   * @param {string} globalName global to expose the copy under
   * @returns {string} app source
   */
  const exposeIndicator = (globalName) =>
    `globalThis.${globalName} = require(${JSON.stringify(INDICATOR_ENTRY)});`;

  const start = async () => {
    hotApp = await createHotApp({
      query: "?progress=false",
      apps: [
        { name: "a", code: exposeIndicator("indicatorA") },
        { name: "b", code: exposeIndicator("indicatorB") },
      ],
    });
    ({ page, browser } = await runBrowser());
  };

  afterEach(async () => {
    ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
  });

  it("stops a sweep when motion is declined mid-build, and recovers", async () => {
    await start();
    await page.goto(hotApp.url);

    const bar = async () =>
      page.evaluate((id) => {
        const host = document.getElementById(id);
        const child =
          host && host.shadowRoot && host.shadowRoot.firstElementChild;

        return child
          ? { width: child.style.width, running: child.getAnimations().length }
          : null;
      }, INDICATOR_ID);

    await page.evaluate(() => {
      globalThis.indicatorA.configure("linear");
      // No percent, so the bar sweeps rather than measuring.
      globalThis.indicatorA.show();
    });

    expect(await bar()).toEqual({ width: "40%", running: 1 });

    // Declined while it is moving.
    await page.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await page.waitForFunction(
      (id) =>
        document.getElementById(id).shadowRoot.firstElementChild.getAnimations()
          .length === 0,
      { timeout: 30000 },
      INDICATOR_ID,
    );

    // A sweep cancelled where it happened to be would sit at 40% looking like
    // progress that stalled, and the stale animation reference would make
    // every later call a no-op.
    expect(await bar()).toEqual({ width: "100%", running: 0 });

    await page.evaluate(() => {
      globalThis.indicatorA.show();
    });

    expect(await bar()).toEqual({ width: "100%", running: 0 });
  });

  it("does not pile up preference listeners across builds", async () => {
    await start();

    // Tracked per query object rather than as a total, because that is where
    // the mistake hides: `matchMedia` hands back a new `MediaQueryList` every
    // call, so removing from a fresh one still *calls* `removeEventListener`
    // and still leaves the listener attached to the object that has it.
    // Installed before any page script runs, so the client's own calls count.
    await page.evaluateOnNewDocument(() => {
      globalThis.__attached = new Map();

      const real = globalThis.matchMedia.bind(globalThis);

      globalThis.matchMedia = (query) => {
        const list = real(query);
        const add = list.addEventListener.bind(list);
        const remove = list.removeEventListener.bind(list);
        const tally = (delta) => {
          globalThis.__attached.set(
            list,
            (globalThis.__attached.get(list) || 0) + delta,
          );
        };

        list.addEventListener = (...args) => {
          tally(1);

          return add(...args);
        };
        list.removeEventListener = (...args) => {
          tally(-1);

          return remove(...args);
        };

        return list;
      };
    });
    await page.goto(hotApp.url);

    const left = await page.evaluate(() => {
      for (let i = 0; i < 3; i++) {
        globalThis.indicatorA.show("Rebuilding…");
        globalThis.indicatorA.hide();
      }

      let worst = 0;

      for (const count of globalThis.__attached.values()) {
        worst = Math.max(worst, count);
      }

      return { worst, queries: globalThis.__attached.size };
    });

    // Three builds registered on three query objects; none may still be
    // holding a listener afterwards.
    expect(left.queries).toBeGreaterThan(0);
    expect(left.worst).toBe(0);
  });

  it("drives a single badge from a second bundled copy", async () => {
    await start();
    await page.goto(hotApp.url);

    const state = await page.evaluate((id) => {
      globalThis.indicatorA.show("Rebuilding…");
      globalThis.indicatorB.show("Rebuilding… 42%", 42);

      const hosts = document.querySelectorAll(`#${id}`);

      return {
        count: hosts.length,
        text: hosts[0] ? hosts[0].shadowRoot.textContent : "",
      };
    }, INDICATOR_ID);

    // One badge, adopted (not stacked) by the second copy, showing its text.
    expect(state.count).toBe(1);
    expect(state.text).toContain("42%");

    // The state is shared, so the first copy's hide() removes the badge the
    // second copy updated.
    await page.evaluate(() => globalThis.indicatorA.hide());
    expect(
      await page.evaluate((id) => document.getElementById(id), INDICATOR_ID),
    ).toBeNull();
  });

  it("keeps the badge while another copy's source is still building", async () => {
    await start();
    await page.goto(hotApp.url);

    await page.evaluate(() => {
      globalThis.indicatorA.show("Rebuilding a…", undefined, "a");
      globalThis.indicatorB.show("Rebuilding b…", undefined, "b");
      globalThis.indicatorB.hide("b");
    });
    expect(
      await page.evaluate(
        (id) => document.getElementById(id) !== null,
        INDICATOR_ID,
      ),
    ).toBe(true);

    await page.evaluate(() => globalThis.indicatorA.hide("a"));
    expect(
      await page.evaluate(
        (id) => document.getElementById(id) !== null,
        INDICATOR_ID,
      ),
    ).toBe(false);
  });

  it("ignores hiding an unknown source and still removes unconditionally", async () => {
    await start();
    await page.goto(hotApp.url);

    await page.evaluate(() => {
      globalThis.indicatorA.show("Rebuilding…", undefined, "a");
      globalThis.indicatorA.hide("unknown");
    });
    expect(
      await page.evaluate(
        (id) => document.getElementById(id) !== null,
        INDICATOR_ID,
      ),
    ).toBe(true);

    // Without a source the badge is removed even with builds pending.
    await page.evaluate(() => globalThis.indicatorA.hide());
    expect(
      await page.evaluate(
        (id) => document.getElementById(id) !== null,
        INDICATOR_ID,
      ),
    ).toBe(false);
  });

  it("fills state fields missing from an older copy's shape", async () => {
    await start();
    // An older package version created a leaner shared state before the
    // bundles load.
    await page.evaluateOnNewDocument((key) => {
      globalThis[key] = { host: null };
    }, INDICATOR_STATE_KEY);
    await page.goto(hotApp.url);

    const count = await page.evaluate((id) => {
      globalThis.indicatorA.show("Rebuilding…");
      return document.querySelectorAll(`#${id}`).length;
    }, INDICATOR_ID);

    expect(count).toBe(1);
  });
});
