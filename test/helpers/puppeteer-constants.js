// Chromium flags for the e2e browser, same spirit as webpack-dev-server's
// puppeteer-constants: deterministic rendering, no sandbox (CI containers),
// and no background throttling that could delay SSE/HMR timers.
const puppeteerArgs = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-extensions",
  "--disable-default-apps",
  "--disable-translate",
  "--disable-sync",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-first-run",
  "--force-color-profile=srgb",
];

module.exports = { puppeteerArgs };
