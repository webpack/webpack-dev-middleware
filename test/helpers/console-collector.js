/**
 * Collect the page's console output and wait for expected messages, so e2e
 * assertions never rely on fixed sleeps.
 * @param {import("puppeteer").Page} page page
 * @returns {{ messages: string[], waitFor: (substring: string, timeout?: number) => Promise<void>, waitForCount: (substring: string, count: number, timeout?: number) => Promise<void> }} collector
 */
function collectConsole(page) {
  /** @type {string[]} */
  const messages = [];

  page.on("console", (message) => {
    messages.push(message.text());
  });

  /**
   * @param {string} substring substring to look for
   * @param {number} count how many matching messages to wait for
   * @param {number} timeout give-up timeout in milliseconds
   * @returns {Promise<void>} resolved when enough messages arrived
   */
  async function waitForCount(substring, count, timeout = 30000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (messages.filter((text) => text.includes(substring)).length >= count) {
        return;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }

    throw new Error(
      `Timed out waiting for ${count} console message(s) containing "${substring}".\nSeen:\n${messages.join("\n")}`,
    );
  }

  return {
    messages,
    waitForCount,
    waitFor: (substring, timeout) => waitForCount(substring, 1, timeout),
  };
}

/**
 * Strip the run-specific parts (timings, temp fixture paths) so browser
 * console output can be snapshotted. Network-error noise emitted by the
 * browser itself ("Failed to load resource: …") is dropped — how many of
 * those a severed connection produces depends on reconnect timing.
 * @param {string[]} messages raw console messages
 * @returns {string[]} normalized messages
 */
function normalizeConsole(messages) {
  return messages
    .filter((text) => !text.startsWith("Failed to load resource"))
    .map((text) =>
      text
        .replaceAll(/\d+\s?ms/g, "Xms")
        .replaceAll(/[^\s(]*wdm-e2e-[^/\s]*/g, "<fixture>")
        // The invalid hook sometimes reports the watched directory instead of
        // the file (polling watcher) — collapse both forms.
        .replaceAll(
          /rebuilding \(<fixture>\S* changed\)/g,
          "rebuilding (<fixture> changed)",
        ),
    );
}

module.exports = collectConsole;
module.exports.normalizeConsole = normalizeConsole;
