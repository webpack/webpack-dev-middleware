import collectConsole from "../helpers/console-collector";
import {
  OVERLAY_ID,
  acceptedApp,
  closeE2e,
  unacceptedApp,
  waitForAppText,
  waitForNoOverlay,
  waitForOverlay,
} from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

// Everything below is the same story over each transport. The client and the
// server agree on which one through matching options, and nothing above them
// is supposed to be able to tell the difference — which is exactly the claim
// worth testing rather than assuming.
for (const transport of ["sse", "ws"]) {
  describe(`hot client over ${transport} (browser)`, () => {
    let hotApp;
    let browser;
    let page;

    afterEach(async () => {
      ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
    });

    it("connects and applies a hot update", async () => {
      hotApp = await createHotApp({ transport, code: acceptedApp("v1") });
      ({ page, browser } = await runBrowser());
      const console_ = collectConsole(page);

      await page.goto(hotApp.url);
      await waitForAppText(page, "v1");
      await console_.waitFor("connected");

      // A marker that survives HMR but not a navigation, so the update below
      // is proved to have been applied rather than reloaded into place.
      await page.evaluate(() => {
        globalThis.notReloaded = true;
      });

      hotApp.edit(acceptedApp("v2"));
      await waitForAppText(page, "v2");

      expect(await page.evaluate(() => globalThis.notReloaded)).toBe(true);
    });

    it("falls back to a reload when the update cannot be applied", async () => {
      hotApp = await createHotApp({ transport, code: unacceptedApp("v1") });
      ({ page, browser } = await runBrowser());

      await page.goto(hotApp.url);
      await waitForAppText(page, "v1");

      await page.evaluate(() => {
        globalThis.notReloaded = true;
      });

      hotApp.edit(unacceptedApp("v2"));
      await waitForAppText(page, "v2");

      // Nothing accepted the update, so the page went round again.
      expect(await page.evaluate(() => globalThis.notReloaded)).toBeUndefined();
    });

    it("shows a build error in the overlay and clears it on recovery", async () => {
      hotApp = await createHotApp({ transport, code: acceptedApp("v1") });
      ({ page, browser } = await runBrowser());

      await page.goto(hotApp.url);
      await waitForAppText(page, "v1");

      hotApp.edit("this is not valid javascript {{{");
      const frame = await waitForOverlay(page);

      expect(await frame.evaluate(() => document.body.textContent)).toContain(
        "Module parse failed",
      );

      // Recovering from a broken build cannot be applied hot, so the page
      // reloads — wait for it to settle before reading the DOM, or the query
      // races the navigation.
      hotApp.edit(acceptedApp("v2"));
      await waitForAppText(page, "v2");
      await waitForNoOverlay(page);

      expect(await page.$(`#${OVERLAY_ID}`)).toBeNull();
    });

    it("catches a client up on what it missed while it was away", async () => {
      hotApp = await createHotApp({ transport, code: acceptedApp("v1") });
      ({ page, browser } = await runBrowser());

      await page.goto(hotApp.url);
      await waitForAppText(page, "v1");

      // Broken before the page is opened, so the overlay can only come from
      // the catch-up a newly connected client is sent.
      hotApp.edit("broken before connecting {{{");
      await page.reload();

      const frame = await waitForOverlay(page);

      expect(await frame.evaluate(() => document.body.textContent)).toContain(
        "Module parse failed",
      );
    });
  });
}
