// Pinned to v22, the last CJS build — jest cannot require the ESM-only
// versions that follow.
const puppeteer = require("puppeteer");

const { puppeteerArgs } = require("./puppeteer-constants");

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
