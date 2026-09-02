// Coverage arrives from two places: jest instruments `src` in this process,
// while the hot client is instrumented in the browser (see
// `browser-coverage.js`). This folds the browser's counters into jest's
// report so `client-src` is measured the same way `src` is.
const fs = require("node:fs");
const path = require("node:path");

const libCoverage = require("istanbul-lib-coverage");
const libReport = require("istanbul-lib-report");
const reports = require("istanbul-reports");

const ROOT = path.join(__dirname, "..", "..");
const COVERAGE_DIR = path.join(ROOT, "coverage");
const E2E_DIR = path.join(COVERAGE_DIR, "e2e");
const JEST_SUMMARY = path.join(COVERAGE_DIR, "coverage-final.json");

/**
 * @returns {import("istanbul-lib-coverage").CoverageMap} every source merged
 */
function collect() {
  const map = libCoverage.createCoverageMap({});

  if (fs.existsSync(JEST_SUMMARY)) {
    map.merge(JSON.parse(fs.readFileSync(JEST_SUMMARY, "utf8")));
  }

  if (fs.existsSync(E2E_DIR)) {
    for (const file of fs.readdirSync(E2E_DIR)) {
      if (file.endsWith(".json")) {
        map.merge(
          JSON.parse(fs.readFileSync(path.join(E2E_DIR, file), "utf8")),
        );
      }
    }
  }

  return map;
}

/**
 * @returns {import("istanbul-lib-coverage").CoverageMap} browser counters only
 */
function collectBrowser() {
  const map = libCoverage.createCoverageMap({});

  if (fs.existsSync(E2E_DIR)) {
    for (const file of fs.readdirSync(E2E_DIR)) {
      if (file.endsWith(".json")) {
        map.merge(
          JSON.parse(fs.readFileSync(path.join(E2E_DIR, file), "utf8")),
        );
      }
    }
  }

  return map;
}

if (require.main === module) {
  // Written as its own report rather than folded into jest's: codecov merges
  // the uploads, and keeping them separate leaves each run's own lcov intact.
  const context = libReport.createContext({
    coverageMap: collectBrowser(),
    dir: path.join(ROOT, "coverage-client"),
  });

  reports.create("lcovonly").execute(context);
  reports.create("json").execute(context);

  // The combined view is what a person wants to read locally.
  reports
    .create("text", { skipEmpty: true })
    .execute(
      libReport.createContext({ coverageMap: collect(), dir: COVERAGE_DIR }),
    );
}

module.exports = collect;
module.exports.collectBrowser = collectBrowser;
