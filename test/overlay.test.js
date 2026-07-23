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
      getOverlay().contentDocument.body.click();
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

  describe("runtime errors", () => {
    it("shows uncaught errors in the overlay and accumulates them", () => {
      configureOverlay({ catchRuntimeError: true });

      globalThis.dispatchEvent(
        new ErrorEvent("error", {
          error: new Error("boom-runtime"),
          message: "boom-runtime",
        }),
      );

      expect(getOverlay()).not.toBeNull();
      expect(getCard().textContent).toContain(
        "Uncaught runtime error: boom-runtime",
      );

      globalThis.dispatchEvent(
        new ErrorEvent("error", {
          error: new Error("boom-2"),
          message: "boom-2",
        }),
      );

      // With pagination (default) the newest runtime error is shown, and the
      // previous one stays reachable.
      expect(getCard().textContent).toContain("boom-2");
      expect(getCard().textContent).toContain("2 / 2");

      getOverlay().contentDocument.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft" }),
      );
      expect(getCard().textContent).toContain("boom-runtime");
    });

    it("shows unhandled promise rejections", () => {
      configureOverlay({ catchRuntimeError: true });

      const event = new Event("unhandledrejection");
      /** @type {EXPECTED_ANY} */ (event).reason = new Error("rejected-boom");
      globalThis.dispatchEvent(event);

      expect(getOverlay()).not.toBeNull();
      expect(getCard().textContent).toContain("rejected-boom");
    });

    it("ignores errors already caught by a React error boundary", () => {
      configureOverlay({ catchRuntimeError: true });

      const error = new Error("boundary");
      error.stack =
        "Error: boundary\n at invokeGuardedCallbackDev (react-dom.js:1:1)";
      globalThis.dispatchEvent(new ErrorEvent("error", { error }));

      expect(getOverlay()).toBeNull();
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

  describe("pagination", () => {
    afterEach(() => {
      // Restore the default.
      configureOverlay({ paginate: true });
    });

    it("shows one problem at a time with a counter by default", () => {
      showProblems("errors", ["first boom", "second boom", "third boom"]);

      expect(getCard().textContent).toContain("first boom");
      expect(getCard().textContent).not.toContain("second boom");
      expect(getCard().textContent).toContain("1 / 3");
    });

    it("navigates with the prev/next buttons and clamps at the ends", () => {
      showProblems("errors", ["first boom", "second boom"]);

      const next = [...getCard().querySelectorAll("button")].find(
        (button) => button.getAttribute("aria-label") === "Next problem",
      );

      next.click();
      expect(getCard().textContent).toContain("second boom");
      expect(getCard().textContent).toContain("2 / 2");

      // Clamped at the last page.
      const nextAgain = [...getCard().querySelectorAll("button")].find(
        (button) => button.getAttribute("aria-label") === "Next problem",
      );

      nextAgain.click();
      expect(getCard().textContent).toContain("2 / 2");

      const prev = [...getCard().querySelectorAll("button")].find(
        (button) => button.getAttribute("aria-label") === "Previous problem",
      );

      prev.click();
      expect(getCard().textContent).toContain("first boom");
    });

    it("navigates with the arrow keys", () => {
      showProblems("errors", ["first boom", "second boom"]);

      getOverlay().contentDocument.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight" }),
      );
      expect(getCard().textContent).toContain("second boom");

      getOverlay().contentDocument.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft" }),
      );
      expect(getCard().textContent).toContain("first boom");
    });

    it("resets to the first page on a new problem set", () => {
      showProblems("errors", ["first boom", "second boom"]);

      getOverlay().contentDocument.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight" }),
      );
      showProblems("errors", ["new first", "new second", "new third"]);

      expect(getCard().textContent).toContain("new first");
      expect(getCard().textContent).toContain("1 / 3");
    });

    it("keeps the current page when the same problems are re-published", () => {
      showProblems("errors", ["first boom", "second boom"]);

      getOverlay().contentDocument.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight" }),
      );
      expect(getCard().textContent).toContain("2 / 2");

      showProblems("errors", ["first boom", "second boom"]);

      expect(getCard().textContent).toContain("second boom");
      expect(getCard().textContent).toContain("2 / 2");
    });

    it("shows the full list when disabled", () => {
      configureOverlay({ paginate: false });
      showProblems("errors", ["first boom", "second boom"]);

      expect(getCard().textContent).toContain("first boom");
      expect(getCard().textContent).toContain("second boom");
      expect(getCard().textContent).not.toContain("1 / 2");
    });
  });

  describe("trusted types", () => {
    afterEach(() => {
      delete globalThis.trustedTypes;
    });

    it("creates a policy with the configured name and renders through it", () => {
      globalThis.trustedTypes = {
        createPolicy: jest.fn((name, rules) => ({
          createHTML: rules.createHTML,
        })),
      };

      configureOverlay({ trustedTypesPolicyName: "custom#policy" });
      showProblems("errors", ["boom"]);

      expect(globalThis.trustedTypes.createPolicy).toHaveBeenCalledWith(
        "custom#policy",
        expect.objectContaining({ createHTML: expect.any(Function) }),
      );
      expect(getCard().textContent).toContain("boom");
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
