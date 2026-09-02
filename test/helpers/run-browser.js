// Pinned to v22, the last CJS build — jest cannot require the ESM-only
// versions that follow.
const puppeteer = require("puppeteer");

const { STASH_KEY, stashingScript } = require("./browser-coverage");
const { puppeteerArgs } = require("./puppeteer-constants");

/**
 * A reload takes `window.__coverage__` with it, which is precisely what the
 * paths ending in one (`reloadPage`, the unaccepted-update branches) would
 * have reported. Park the counters in `sessionStorage`, which survives a
 * same-origin navigation, for the harvest to pick up afterwards.
 * @param {import("puppeteer").Page} page page
 * @returns {Promise<void>} resolved once the hook is installed
 */
async function stashCoverageAcrossReloads(page) {
  if (!stashingScript) {
    return;
  }

  await page.evaluateOnNewDocument(stashingScript, STASH_KEY);
}

/**
 * @typedef {object} RunBrowserResult
 * @property {import("puppeteer").Page} page page
 * @property {import("puppeteer").Browser} browser browser
 */

/**
 * Create a page in the given browser, answering favicon requests so they do
 * not produce noise (same pattern as webpack-dev-server's run-browser helper).
 * @param {import("puppeteer").Browser} browser browser
 * @returns {Promise<import("puppeteer").Page>} configured page
 */
async function runPage(browser) {
  const page = await browser.newPage();

  await stashCoverageAcrossReloads(page);
  await page.setRequestInterception(true);

  page.on("request", (interceptedRequest) => {
    if (interceptedRequest.isInterceptResolutionHandled()) {
      return;
    }

    if (interceptedRequest.url().includes("favicon.ico")) {
      interceptedRequest.respond({
        status: 200,
        contentType: "image/png",
        body: "Empty",
      });
    } else {
      interceptedRequest.continue();
    }
  });

  await page.setViewport({ width: 800, height: 600 });

  return page;
}

/**
 * @returns {Promise<RunBrowserResult>} browser and a ready page
 */
async function runBrowser() {
  const browser = await puppeteer.launch({
    headless: true,
    args: puppeteerArgs,
  });

  const page = await runPage(browser);

  return { page, browser };
}

module.exports = runBrowser;
module.exports.runPage = runPage;
