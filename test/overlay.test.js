/**
 * @jest-environment jsdom
 */

import configureOverlay, { clear, showProblems } from "../client-src/overlay";

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

const OVERLAY_ID = "webpack-dev-middleware-hot-overlay";

/**
 * @returns {HTMLIFrameElement | null} the overlay iframe (the backdrop), if mounted
 */
function getOverlay() {
  return /** @type {HTMLIFrameElement | null} */ (
    document.getElementById(OVERLAY_ID)
  );
}

/**
 * @returns {HTMLElement} the visible card element inside the iframe
 */
function getCard() {
  return /** @type {HTMLElement} */ (
    /** @type {Document} */ (
      /** @type {HTMLIFrameElement} */ (getOverlay()).contentDocument
    ).getElementById(`${OVERLAY_ID}-card`)
  );
}

/**
 * @param {string} color expected normalized color
 * @returns {HTMLElement | undefined} the first span rendered in that text color
 */
function findSpanByColor(color) {
  return [...getCard().querySelectorAll("span")].find(
    (span) => span.style.color === color,
  );
}

describe("overlay", () => {
  afterEach(() => {
    clear();
  });

  describe("showProblems", () => {
    it("highlights the offending code-frame line", () => {
      showProblems("errors", ["./a.js 1:1\n> 1 | const x =\n  | ^"]);
      expect(findSpanByColor("rgb(255, 107, 107)")).toBeDefined();
    });

    it("re-mounts the overlay when the iframe was removed without clear()", () => {
      showProblems("errors", ["boom"]);
      // A framework wiping `document.body` removes the iframe behind our back.
      getOverlay().remove();
      // Re-publishing the identical set must re-mount, not hit the
      // unchanged-set guard.
      showProblems("errors", ["boom"]);
      expect(getOverlay()).not.toBeNull();
      expect(getCard().textContent).toContain("boom");
    });
  });

  describe("clear", () => {
    it("is a no-op when nothing is shown", () => {
      expect(() => clear()).not.toThrow();
    });
  });

  describe("configureOverlay", () => {
    it("applies custom overlay styles to the card", () => {
      configureOverlay({ overlayStyles: { maxWidth: "500px" } });
      showProblems("errors", ["boom"]);
      expect(getCard().style.maxWidth).toBe("500px");
    });

    it("honors custom ansi colors for the problem color", () => {
      configureOverlay({ ansiColors: { red: "00ff00" } });
      showProblems("errors", ["boom"]);
      expect(getCard().querySelector("span").style.backgroundColor).toBe(
        "rgb(0, 255, 0)",
      );
      expect(getCard().style.borderTopColor).toBe("rgb(0, 255, 0)");

      // Restore the default so module-level state does not leak.
      configureOverlay({ ansiColors: { red: "ff3348" } });
    });
  });
});
