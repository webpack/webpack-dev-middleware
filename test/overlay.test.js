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

  describe("runtime errors", () => {
    it("ignores errors already caught by a React error boundary", () => {
      configureOverlay({ catchRuntimeError: true });

      const error = new Error("boundary");
      error.stack =
        "Error: boundary\n at invokeGuardedCallbackDev (react-dom.js:1:1)";
      globalThis.dispatchEvent(new ErrorEvent("error", { error }));

      expect(getOverlay()).toBeNull();
    });

    it("resets the accumulation when the runtime slot is cleared", () => {
      configureOverlay({ catchRuntimeError: true });

      globalThis.dispatchEvent(
        new ErrorEvent("error", {
          error: new Error("boom-before"),
          message: "boom-before",
        }),
      );
      expect(getCard().textContent).toContain("boom-before");

      // What the reporter does on a clean build.
      clear("runtime");
      expect(getOverlay()).toBeNull();

      globalThis.dispatchEvent(
        new ErrorEvent("error", {
          error: new Error("boom-after"),
          message: "boom-after",
        }),
      );

      expect(getCard().textContent).toContain("boom-after");
      expect(getCard().textContent).not.toContain("boom-before");
      expect(getCard().textContent).not.toContain("1 / 2");
    });
  });

  describe("open in editor", () => {
    afterEach(() => {
      configureOverlay({ openEditorEndpoint: "" });
      delete globalThis.fetch;
    });

    it("makes file chips clickable and calls the configured endpoint", () => {
      // eslint-disable-next-line jest/prefer-spy-on -- jsdom does not define fetch
      globalThis.fetch = jest.fn(() => Promise.resolve());
      configureOverlay({ openEditorEndpoint: "/__open-editor" });
      showProblems("errors", ["./src/render.js 7:2\nModule parse failed"]);

      const chip = /** @type {Document} */ (
        getOverlay().contentDocument
      ).querySelector("[data-open-file]");

      expect(chip).not.toBeNull();
      expect(chip.getAttribute("data-open-file")).toBe("./src/render.js:7:2");

      chip.click();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `/__open-editor?fileName=${encodeURIComponent("./src/render.js:7:2")}`,
      );
    });

    it("does not mark file chips when no endpoint is configured", () => {
      showProblems("errors", ["./src/render.js 7:2\nModule parse failed"]);

      expect(
        /** @type {Document} */ (getOverlay().contentDocument).querySelector(
          "[data-open-file]",
        ),
      ).toBeNull();
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
