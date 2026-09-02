// Coverage for the hot client is produced in the browser, not in this
// process: the e2e bundle is instrumented by `babel-plugin-istanbul` (see
// `hot-app.js`) and every page carries its counters on `window.__coverage__`.
// They are harvested before the browser closes and written per worker, for
// `merge-coverage.js` to turn into a report.
const fs = require("node:fs");
const path = require("node:path");

const libCoverage = require("istanbul-lib-coverage");

const OUTPUT_DIR = path.join(__dirname, "..", "..", "coverage", "e2e");

const enabled = Boolean(process.env.E2E_COVERAGE);

const STASH_KEY = "__wdm_coverage_stash__";

/* The two functions below are handed to puppeteer and run inside the page,
   where `sessionStorage` is the browser's, not node's experimental one. */
/* eslint-disable n/no-unsupported-features/node-builtins */

/**
 * Installed into every page (see `run-browser.js`): on the way out, append
 * the counters to `sessionStorage` so a reload cannot lose them.
 * @param {string} key session storage key
 * @returns {void}
 */
const stashingScript = enabled
  ? (key) => {
      globalThis.addEventListener("pagehide", () => {
        const data = globalThis.__coverage__;

        if (!data) {
          return;
        }

        try {
          const stash = JSON.parse(sessionStorage.getItem(key) || "[]");

          stash.push(data);
          sessionStorage.setItem(key, JSON.stringify(stash));
        } catch {
          // A storage-less or full context simply keeps what it has.
        }
      });
    }
  : undefined;

/**
 * Read the live counters and anything a reload parked.
 * @param {string} key session storage key
 * @returns {EXPECTED_ANY[]} the live counters, then the parked ones
 */
const readScript = (key) => {
  let parked = [];

  try {
    parked = JSON.parse(sessionStorage.getItem(key) || "[]");
  } catch {
    // No storage in this context.
  }

  return [globalThis.__coverage__, parked];
};

/* eslint-enable n/no-unsupported-features/node-builtins */

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

let map;

/**
 * Write what this worker collected. One file per process, so parallel workers
 * cannot overwrite each other.
 * @returns {void}
 */
function flush() {
  if (!enabled || !map) {
    return;
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const file = path.join(OUTPUT_DIR, `coverage-${process.pid}.json`);
  // Jest resets the module registry between test files, so `map` starts empty
  // for each of them while this file stays. Fold into what is already there
  // rather than replacing an earlier suite's counters with this one's.
  const merged = libCoverage.createCoverageMap({});

  if (fs.existsSync(file)) {
    merged.merge(JSON.parse(fs.readFileSync(file, "utf8")));
  }

  merged.merge(map);
  fs.writeFileSync(file, JSON.stringify(merged.toJSON()));
}

/**
 * Read the counters off every page of a browser about to close. A page that
 * navigated away, crashed, or is already gone simply has nothing to add.
 * @param {import("puppeteer").Browser=} browser browser about to close
 * @returns {Promise<void>} resolved once every page has been read
 */
async function harvest(browser) {
  if (!enabled || !browser) {
    return;
  }

  if (!map) {
    map = libCoverage.createCoverageMap({});
  }

  let pages;

  try {
    pages = await browser.pages();
  } catch {
    return;
  }

  await Promise.all(
    pages.map(async (page) => {
      try {
        const [live, stashed] = await page.evaluate(readScript, STASH_KEY);

        for (const data of [live, ...stashed]) {
          if (data) {
            map.merge(data);
          }
        }
      } catch {
        // A closed or navigating page has no counters to give.
      }
    }),
  );

  // Written after every harvest rather than on exit: a jest worker is torn
  // down without running `process.on("exit")` handlers.
  flush();
}

module.exports = { STASH_KEY, flush, harvest, stashingScript };
