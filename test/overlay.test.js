/**
 * @jest-environment jsdom
 */

import configureOverlay, { clear, showProblems } from "../client-src/overlay";

const OVERLAY_ID = "webpack-dev-middleware-hot-overlay";

/**
 * @returns {HTMLElement | null} the overlay backdrop, if mounted
 */
function getOverlay() {
  return document.getElementById(OVERLAY_ID);
}

/**
 * @returns {HTMLElement} the visible card element inside the backdrop
 */
function getCard() {
  return /** @type {HTMLElement} */ (
    /** @type {HTMLElement} */ (getOverlay()).firstElementChild
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
    it("mounts the overlay on the document body", () => {
      expect(getOverlay()).toBeNull();
      showProblems("errors", ["./a.js 1:1\nboom"]);
      expect(getOverlay()).not.toBeNull();
    });

    it("renders an ERROR badge in the error color for errors", () => {
      showProblems("errors", ["boom"]);
      const badge = getCard().querySelector("span");
      expect(badge.textContent).toBe("ERROR");
      expect(badge.style.backgroundColor).toBe("rgb(255, 51, 72)");
    });

    it("renders a WARNING badge in the warning color for warnings", () => {
      showProblems("warnings", ["careful"]);
      const badge = getCard().querySelector("span");
      expect(badge.textContent).toBe("WARNING");
      expect(badge.style.backgroundColor).toBe("rgb(255, 211, 14)");
    });

    it("colors the top accent bar red for errors and yellow for warnings", () => {
      showProblems("errors", ["boom"]);
      expect(getCard().style.borderTopColor).toBe("rgb(255, 51, 72)");
      showProblems("warnings", ["careful"]);
      expect(getCard().style.borderTopColor).toBe("rgb(255, 211, 14)");
    });

    it("highlights the file path and leaves the location uncolored", () => {
      showProblems("errors", ["./src/render.js 7:2\nModule parse failed"]);
      const pathSpan = [...getCard().querySelectorAll("span")].find(
        (span) => span.textContent === "./src/render.js",
      );
      expect(pathSpan).toBeDefined();
      expect(pathSpan.style.color).toBe("rgb(141, 214, 249)");
      // The `7:2` location is rendered as plain text, not inside the span.
      expect(getCard().textContent).toContain("./src/render.js 7:2");
    });

    it("highlights the offending code-frame line", () => {
      showProblems("errors", ["./a.js 1:1\n> 1 | const x =\n  | ^"]);
      expect(findSpanByColor("rgb(255, 107, 107)")).toBeDefined();
    });

    it("turns URLs into links that open in a new tab", () => {
      showProblems("errors", ["See https://webpack.js.org/concepts#loaders"]);
      const link = getCard().querySelector("a");
      expect(link).not.toBeNull();
      expect(link.getAttribute("href")).toBe(
        "https://webpack.js.org/concepts#loaders",
      );
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("keeps trailing punctuation out of the link href", () => {
      showProblems("errors", ["Docs: https://example.com/a."]);
      const link = getCard().querySelector("a");
      expect(link.getAttribute("href")).toBe("https://example.com/a");
      expect(getCard().textContent).toContain("https://example.com/a.");
    });

    it("shows a dismiss hint", () => {
      showProblems("errors", ["boom"]);
      expect(getCard().textContent).toContain(
        "Click outside, press Esc, or fix the code to dismiss.",
      );
    });

    it("replaces previous problems on each call", () => {
      showProblems("errors", ["first"]);
      showProblems("errors", ["second"]);
      expect(getCard().textContent).toContain("second");
      expect(getCard().textContent).not.toContain("first");
    });
  });

  describe("clear", () => {
    it("removes the overlay from the DOM", () => {
      showProblems("errors", ["boom"]);
      expect(getOverlay()).not.toBeNull();
      clear();
      expect(getOverlay()).toBeNull();
    });

    it("is a no-op when nothing is shown", () => {
      expect(() => clear()).not.toThrow();
    });
  });

  describe("dismiss", () => {
    it("closes when pressing Escape", () => {
      showProblems("errors", ["boom"]);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(getOverlay()).toBeNull();
    });

    it("closes when clicking the backdrop", () => {
      showProblems("errors", ["boom"]);
      getOverlay().click();
      expect(getOverlay()).toBeNull();
    });

    it("stays open when clicking inside the card", () => {
      showProblems("errors", ["boom"]);
      getCard().click();
      expect(getOverlay()).not.toBeNull();
    });

    it("closes when clicking the close button", () => {
      showProblems("errors", ["boom"]);
      const closeButton = getCard().querySelector("button");
      expect(closeButton).not.toBeNull();
      closeButton.click();
      expect(getOverlay()).toBeNull();
    });
  });

  describe("configureOverlay", () => {
    it("returns the overlay API", () => {
      const api = configureOverlay({});
      expect(typeof api.showProblems).toBe("function");
      expect(typeof api.clear).toBe("function");
    });

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
