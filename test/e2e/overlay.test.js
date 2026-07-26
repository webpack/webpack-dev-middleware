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
    const frame = await waitForOverlay(page);

    // The card advertises exactly what this test is about to do.
    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "Click outside, press Esc, or fix the code to dismiss.",
    );

    await page.keyboard.press("Escape");
    await waitForNoOverlay(page);

    expect(await page.$(`#${OVERLAY_ID}`)).toBeNull();
  });

  it("dismisses on backdrop and close-button clicks, but not inside the card", async () => {
    hotApp = await createHotApp({ code: app("v1") });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);

    hotApp.edit("broken for clicks {{{");
    let frame = await waitForOverlay(page);

    // Clicking inside the card keeps the overlay open…
    await frame.click(`#${OVERLAY_ID}-card`);
    expect(await page.$(`#${OVERLAY_ID}`)).not.toBeNull();

    // …clicking the backdrop (top-left corner, away from the centered card)
    // dismisses it.
    const body = await frame.$("body");
    await body.click({ offset: { x: 5, y: 5 } });
    await waitForNoOverlay(page);

    // A reload brings the overlay back through the catch-up sync — dismiss
    // it again through the close (×) button.
    await page.reload();
    frame = await waitForOverlay(page);
    await frame.click('[aria-label="Close"]');
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
    await console_.waitFor("broken b {{{");
    expect(normalizeConsole(console_.messages)).toMatchSnapshot();

    // One problem at a time, with a counter.
    await frame.waitForFunction(() =>
      document.body.textContent.includes("1 / 2"),
    );

    await frame.click('[aria-label="Next problem"]');
    await frame.waitForFunction(() =>
      document.body.textContent.includes("2 / 2"),
    );

    // Real keyboard navigation — the frame has focus after the click.
    await page.keyboard.press("ArrowLeft");
    await frame.waitForFunction(() =>
      document.body.textContent.includes("1 / 2"),
    );
    await page.keyboard.press("ArrowRight");
    await frame.waitForFunction(() =>
      document.body.textContent.includes("2 / 2"),
    );

    // Clamped at the last page.
    await frame.click('[aria-label="Next problem"]');
    await page.keyboard.press("ArrowRight");
    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "2 / 2",
    );
  });

  it("shows the full problem list when paginate=false", async () => {
    hotApp = await createHotApp({
      query: '?overlay={"paginate":false}',
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

    await page.goto(hotApp.url);

    const frame = await waitForOverlay(page);
    await frame.waitForFunction(
      () =>
        document.body.textContent.includes("broken a {{{") &&
        document.body.textContent.includes("broken b {{{"),
    );

    // Both problems at once, no pager.
    expect(await frame.evaluate(() => document.body.textContent)).not.toContain(
      "1 / 2",
    );
  });

  it("accumulates runtime errors and pages between them", async () => {
    hotApp = await createHotApp({
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

    await page.evaluate(() => globalThis.boom("boom-one"));
    const frame = await waitForOverlay(page);
    await frame.waitForFunction(() =>
      document.body.textContent.includes("boom-one"),
    );

    // A second error joins the pager; the newest one is shown.
    await page.evaluate(() => globalThis.boom("boom-two"));
    await frame.waitForFunction(
      () =>
        document.body.textContent.includes("boom-two") &&
        document.body.textContent.includes("2 / 2"),
    );

    // The previous error stays reachable.
    await frame.click('[aria-label="Previous problem"]');
    await frame.waitForFunction(() =>
      document.body.textContent.includes("boom-one"),
    );
    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "1 / 2",
    );
  });

  it("shows unhandled promise rejections", async () => {
    hotApp = await createHotApp({
      // The rejection must originate from the page's own script so the
      // unhandledrejection event carries the real reason.
      code: `
        document.getElementById("app").textContent = "v1";
        globalThis.rejectSoon = (message) => {
          setTimeout(() => {
            Promise.reject(new Error(message));
          }, 0);
        };
      `,
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await page.waitForFunction(
      () => document.getElementById("app")?.textContent === "v1",
    );

    await page.evaluate(() => globalThis.rejectSoon("rejected-boom"));

    const frame = await waitForOverlay(page);

    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "rejected-boom",
    );
  });

  it("renders under an enforced Trusted Types CSP with the configured policy", async () => {
    hotApp = await createHotApp({
      query: '?overlay={"trustedTypesPolicyName":"wdm-test"}',
      code: app("v1"),
      // Real enforcement, which jsdom cannot do: every HTML sink must go
      // through the "wdm-test" policy or Chrome throws. The about:blank
      // overlay iframe inherits this policy from the page.
      pageHeaders: {
        "Content-Security-Policy":
          "require-trusted-types-for 'script'; trusted-types wdm-test",
      },
    });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);
    await page.waitForFunction(
      () => document.getElementById("app")?.textContent === "v1",
    );

    hotApp.edit("broken by csp {{{");

    // The overlay renders — proof that every innerHTML write went through
    // the configured policy (a raw write, or a policy under any other name,
    // would have thrown under this CSP).
    const frame = await waitForOverlay(page);
    await frame.waitForFunction(() =>
      document.body.textContent.includes("Module parse failed"),
    );
    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "broken by csp",
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

describe("overlay shared state across bundled copies (browser)", () => {
  const OVERLAY_ENTRY = require.resolve("../../client-src/overlay.js");
  const OVERLAY_STATE_KEY = "__webpack_dev_middleware_hot_overlay_state__";
  const CARD_ID = `${OVERLAY_ID}-card`;

  let hotApp;
  let browser;
  let page;

  /**
   * Two real bundled copies of the overlay module — one per compilation —
   * exposed as globals so the tests can drive both from the page.
   * @param {string} globalName global to expose the copy under
   * @returns {string} app source
   */
  const exposeOverlay = (globalName) =>
    `globalThis.${globalName} = require(${JSON.stringify(OVERLAY_ENTRY)});
     globalThis.boom = (message) => {
       setTimeout(() => {
         throw new Error(message);
       }, 0);
     };`;

  const start = async () => {
    hotApp = await createHotApp({
      // overlay=false keeps the real hot clients from reporting into the
      // overlay these tests drive themselves.
      query: "?overlay=false",
      apps: [
        { name: "a", code: exposeOverlay("overlayA") },
        { name: "b", code: exposeOverlay("overlayB") },
      ],
    });
    ({ page, browser } = await runBrowser());
  };

  /**
   * @returns {Promise<import("puppeteer").Frame>} the overlay iframe's frame
   */
  const overlayFrame = async () => {
    const handle = await page.waitForSelector(`#${OVERLAY_ID}`, {
      timeout: 30000,
    });

    return handle.contentFrame();
  };

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

  it("shows the problems of two copies in the same overlay", async () => {
    await start();
    await page.goto(hotApp.url);

    await page.evaluate(() => {
      globalThis.overlayA.showProblems("errors", ["boom from copy A"]);
      globalThis.overlayB.showProblems("errors", ["boom from copy B"], "b");
    });

    // One iframe: the second copy adopted it instead of stacking another,
    // and both sources are paginated together in the union.
    expect(
      await page.evaluate(() => document.querySelectorAll("iframe").length),
    ).toBe(1);

    const frame = await overlayFrame();

    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "boom from copy A",
    );
    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "1 / 2",
    );

    await frame.click('[aria-label="Next problem"]');
    await frame.waitForFunction(() =>
      document.body.textContent.includes("boom from copy B"),
    );

    // The state is shared both ways: dismissing from the first copy removes
    // the overlay the second copy rendered into.
    await page.evaluate(() => globalThis.overlayA.clear());
    expect(
      await page.evaluate(() => document.querySelectorAll("iframe").length),
    ).toBe(0);
  });

  it("prefers one copy's errors over another copy's warnings", async () => {
    await start();
    await page.goto(hotApp.url);

    await page.evaluate(() => {
      globalThis.overlayA.showProblems("errors", ["boom from copy A"]);
      globalThis.overlayB.showProblems(
        "warnings",
        ["careful from copy B"],
        "b",
      );
    });

    const frame = await overlayFrame();
    const errorRed = "rgb(255, 51, 72)";
    const warningYellow = "rgb(255, 211, 14)";

    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "boom from copy A",
    );
    expect(await frame.evaluate(() => document.body.textContent)).not.toContain(
      "careful from copy B",
    );
    expect(
      await frame.evaluate(
        (id) => document.getElementById(id).style.borderTopColor,
        CARD_ID,
      ),
    ).toBe(errorRed);

    // Once the erroring source recovers, the warnings surface.
    await page.evaluate(() => globalThis.overlayA.clear(""));
    await frame.waitForFunction(() =>
      document.body.textContent.includes("careful from copy B"),
    );
    expect(
      await frame.evaluate(
        (id) => document.getElementById(id).style.borderTopColor,
        CARD_ID,
      ),
    ).toBe(warningYellow);
  });

  it("does not re-render when a copy clears a source that reported nothing", async () => {
    await start();
    await page.goto(hotApp.url);

    await page.evaluate(() => {
      globalThis.overlayA.showProblems("errors", ["a", "b"], "x");
    });

    const frame = await overlayFrame();

    await frame.evaluate((id) => {
      globalThis.__cardChild = document.getElementById(id).firstElementChild;
    }, CARD_ID);

    // What the reporter does on every clean build of its own bundle.
    await page.evaluate(() => globalThis.overlayB.clear("never-reported"));

    // Same DOM nodes — the card the other copy is showing was not rebuilt.
    expect(
      await frame.evaluate(
        (id) =>
          globalThis.__cardChild ===
          document.getElementById(id).firstElementChild,
        CARD_ID,
      ),
    ).toBe(true);
    expect(await page.$(`#${OVERLAY_ID}`)).not.toBeNull();
  });

  it("honors the runtime filter configured by a later copy", async () => {
    await start();
    await page.goto(hotApp.url);

    // The first copy attaches the window listeners; a runtime error lands in
    // the overlay, proving they are live.
    await page.evaluate(() => {
      globalThis.overlayA.default({ catchRuntimeError: true });
      globalThis.boom("caught-by-A");
    });
    await page.waitForSelector(`#${OVERLAY_ID}`, { timeout: 30000 });
    await page.evaluate(() => globalThis.overlayA.clear());

    // A later copy swaps in a rejecting filter — the listeners the first
    // copy attached must honor it.
    await page.evaluate(() => {
      globalThis.overlayB.default({ catchRuntimeError: () => false });
      globalThis.boom("filtered-out");
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    expect(await page.$(`#${OVERLAY_ID}`)).toBeNull();
  });

  it("resets the page for a new problem set and keeps it for a re-publish", async () => {
    await start();
    await page.goto(hotApp.url);

    await page.evaluate(() => {
      globalThis.overlayA.showProblems("errors", ["first boom", "second boom"]);
    });
    const frame = await overlayFrame();
    await frame.click('[aria-label="Next problem"]');
    await frame.waitForFunction(() =>
      document.body.textContent.includes("2 / 2"),
    );

    // Re-publishing the same problems (every clean rebuild does) keeps the
    // page the user navigated to…
    await page.evaluate(() => {
      globalThis.overlayA.showProblems("errors", ["first boom", "second boom"]);
    });
    await frame.waitForFunction(() =>
      document.body.textContent.includes("2 / 2"),
    );
    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "second boom",
    );

    // …while a different set starts back at the first page.
    await page.evaluate(() => {
      globalThis.overlayA.showProblems("errors", [
        "new first",
        "new second",
        "new third",
      ]);
    });
    await frame.waitForFunction(() =>
      document.body.textContent.includes("1 / 3"),
    );
    expect(await frame.evaluate(() => document.body.textContent)).toContain(
      "new first",
    );
  });

  it("fills state fields missing from an older copy's shape", async () => {
    await start();
    // An older package version created a leaner shared state before the
    // bundles load.
    await page.evaluateOnNewDocument((key) => {
      globalThis[key] = { frame: null, card: null };
    }, OVERLAY_STATE_KEY);
    await page.goto(hotApp.url);

    await page.evaluate(() => {
      globalThis.overlayA.showProblems("errors", ["boom"], "newer");
    });

    expect(
      await page.evaluate(() => document.querySelectorAll("iframe").length),
    ).toBe(1);
  });
});
