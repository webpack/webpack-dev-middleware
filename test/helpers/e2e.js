/* global document -- evaluated inside the browser via waitForFunction */
const OVERLAY_ID = "webpack-dev-middleware-hot-overlay";
const CARD_ID = `${OVERLAY_ID}-card`;
const INDICATOR_ID = "webpack-dev-middleware-building-indicator";

/**
 * @param {import("puppeteer").Page} page page
 * @param {string} id element id
 * @param {string} text expected text
 * @returns {Promise<void>} resolved when rendered
 */
function waitForText(page, id, text) {
  return page
    .waitForFunction(
      (elementId, expected) =>
        document.getElementById(elementId)?.textContent === expected,
      // Interval polling: the default requestAnimationFrame polling freezes
      // on hidden pages (e.g. a backgrounded tab).
      { timeout: 30000, polling: 100 },
      id,
      text,
    )
    .then(() => {});
}

/**
 * @param {import("puppeteer").Page} page page
 * @param {string} text expected #app text
 * @returns {Promise<void>} resolved when rendered
 */
function waitForAppText(page, text) {
  return waitForText(page, "app", text);
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
      { timeout: 30000, polling: 100 },
      OVERLAY_ID,
    )
    .then(() => {});
}

/**
 * A self-accepting module: HMR updates re-run it in place.
 * @param {string} text text rendered into #app
 * @returns {string} app source
 */
function acceptedApp(text) {
  return `
    document.getElementById("app").textContent = ${JSON.stringify(text)};
    if (module.hot) {
      module.hot.accept();
    }
  `;
}

/**
 * A module that never accepts updates — applying one needs a full reload.
 * @param {string} text text rendered into #app
 * @returns {string} app source
 */
function unacceptedApp(text) {
  return `document.getElementById("app").textContent = ${JSON.stringify(text)};`;
}

/**
 * Self-accepting and carrying webpack's "Critical dependency" warning — the
 * fixed-position `require(<expression>)` keeps the warning text identical
 * across edits.
 * @param {string} text text rendered into #app
 * @returns {string} app source
 */
function warningApp(text) {
  return `
    document.getElementById("app").textContent = ${JSON.stringify(text)};
    const dep = "./nothing";
    try {
      require(dep);
    } catch (err) {
      // expected
    }
    if (module.hot) {
      module.hot.accept();
    }
  `;
}

/**
 * Exposes a boom(message) helper that throws from the page's own script —
 * errors raised inside evaluate() reach window.onerror as "Script error".
 * @param {string} text text rendered into #app
 * @returns {string} app source
 */
function boomApp(text) {
  return `
    document.getElementById("app").textContent = ${JSON.stringify(text)};
    globalThis.boom = (message) => {
      setTimeout(() => {
        throw new Error(message);
      }, 0);
    };
  `;
}

/**
 * Tear a test's browser and hot-app down; a rejected browser.close() must
 * not leak the watcher, the server, and the temp dir behind it.
 * @param {import("puppeteer").Browser=} browser browser
 * @param {EXPECTED_ANY=} app hot app
 * @returns {Promise<{ browser: undefined, app: undefined }>} cleared slots
 */
async function closeE2e(browser, app) {
  try {
    if (browser) {
      await browser.close();
    }
  } finally {
    if (app) {
      await app.close();
    }
  }

  return { browser: undefined, app: undefined };
}

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

module.exports = {
  CARD_ID,
  INDICATOR_ID,
  OVERLAY_ID,
  acceptedApp,
  boomApp,
  closeE2e,
  unacceptedApp,
  waitForAppText,
  waitForNoOverlay,
  waitForOverlay,
  waitForText,
  warningApp,
};
