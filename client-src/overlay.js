import ansiHTML from "ansi-html-community";

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/** @type {Record<string, string>} */
const characterReferences = {
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
  "&": "&amp;",
};

/**
 * Encode the characters that are meaningful in HTML. Inlined (same as
 * webpack-dev-server's overlay) so the client does not need `html-entities`.
 * @param {string} text raw text
 * @returns {string} entity-encoded text
 */
function encodeHtmlEntity(text) {
  if (!text) {
    return "";
  }

  return text.replace(/[<>'"&]/g, (character) => {
    return characterReferences[character];
  });
}

const OVERLAY_ID = "webpack-dev-middleware-hot-overlay";
const CARD_ID = `${OVERLAY_ID}-card`;

// The overlay lives inside an `about:blank` iframe (same pattern as
// webpack-dev-server) so page styles cannot leak into it and its styles cannot
// leak out. Every style is applied through the CSSOM (`element.style`), which
// a strict `style-src` Content Security Policy allows, unlike inline `style`
// attributes.

/**
 * The iframe acts as the backdrop: it covers the viewport and dims the page.
 * @type {Record<string, string | number>}
 */
const backdropStyles = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: "100vw",
  height: "100vh",
  border: "none",
  zIndex: 9999,
  // webpack "Outer Space" (#2B3A42), translucent.
  background: "rgba(43,58,66,0.72)",
};

/** @type {Record<string, string | number>} */
const styles = {
  // Dark panel; the top accent bar color is set per problem type in showProblems.
  position: "relative",
  background: "#101619",
  color: "#f2f2f2",
  lineHeight: "1.6",
  whiteSpace: "pre-wrap",
  fontFamily: "Menlo, Consolas, 'Courier New', monospace",
  fontSize: "14px",
  width: "100%",
  maxWidth: "960px",
  maxHeight: "90vh",
  margin: "auto",
  padding: "28px 32px",
  boxSizing: "border-box",
  borderRadius: "8px",
  borderTop: "3px solid #ff3348",
  boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
  overflow: "auto",
  direction: "ltr",
  textAlign: "left",
};

/** @type {Record<string, string | number>} */
const bodyStyles = {
  margin: 0,
  padding: "32px",
  boxSizing: "border-box",
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "auto",
  background: "transparent",
};

/** @type {Record<string, string | number>} */
const closeButtonStyles = {
  position: "absolute",
  top: "8px",
  right: "12px",
  border: "none",
  background: "transparent",
  color: "#999999",
  fontSize: "22px",
  lineHeight: "1",
  cursor: "pointer",
  padding: "0",
};

/** @type {Record<string, string | string[]>} */
const colors = {
  reset: ["transparent", "transparent"],
  black: "181818",
  red: "ff3348",
  green: "3fff4f",
  yellow: "ffd30e",
  blue: "169be0",
  magenta: "f840b7",
  cyan: "0ad8e9",
  lightgrey: "ebe7e3",
  darkgrey: "6d7891",
};

/** @type {HTMLIFrameElement | null} */
let overlayFrame = null;
/** @type {HTMLElement | null} */
let overlayCard = null;

// Runtime error capture (same behavior as webpack-dev-server's
// `catchRuntimeError`): uncaught errors and unhandled promise rejections are
// rendered in the overlay. Messages accumulate until the overlay is cleared.
/** @type {string[]} */
let runtimeMessages = [];
let runtimeListenersAttached = false;

// Trusted Types support (same pattern as webpack-dev-server): when the page
// runs under `require-trusted-types-for 'script'`, every `innerHTML` write
// must go through a policy.
/** @type {{ createHTML: (value: string) => EXPECTED_ANY } | undefined} */
let trustedTypesPolicy;
/** @type {string | undefined} */
let trustedTypesPolicyName;

/**
 * @param {HTMLElement} element element
 * @param {string} html html to assign
 */
function setHTML(element, html) {
  element.innerHTML = trustedTypesPolicy
    ? trustedTypesPolicy.createHTML(html)
    : html;
}

/**
 * @param {EXPECTED_ANY} element element
 * @param {Record<string, string | number>} style style map
 */
function applyStyle(element, style) {
  for (const key of Object.keys(style)) {
    element.style[key] = style[key];
  }
}

/**
 * Re-apply the inline `style` attributes produced by `ansi-html` (and our own
 * highlight helpers) through the CSSOM. Under a strict `style-src` CSP the
 * parser ignores `style` attributes, but CSSOM writes are always allowed.
 * @param {HTMLElement} root subtree to normalize
 */
function normalizeInlineStyles(root) {
  for (const element of root.querySelectorAll("[style]")) {
    /** @type {EXPECTED_ANY} */ (element).style.cssText =
      element.getAttribute("style");
  }
}

/**
 * @param {"errors" | "warnings"} type problem type
 * @returns {string | string[]} hex color (without `#`) for the given type
 */
function problemColor(type) {
  /** @type {Record<string, string | string[]>} */
  const problemColors = {
    errors: colors.red,
    warnings: colors.yellow,
  };
  return problemColors[type] || colors.red;
}

/**
 * @param {"errors" | "warnings"} type problem type
 * @returns {string} HTML span with a colored badge
 */
function problemType(type) {
  const color = problemColor(type);
  return (
    `<span style="background-color:#${color}; color:#000000; ` +
    'padding:3px 6px; border-radius: 4px;">' +
    `${type.slice(0, -1).toUpperCase()}</span>`
  );
}

/**
 * Highlight the offending line of a code frame — the one webpack marks with a
 * leading `>` gutter — so it stands out from the surrounding context lines.
 * @param {string} html message HTML (already entity-encoded, so `>` is `&gt;`)
 * @returns {string} HTML with the error line wrapped in a colored span
 */
function highlightCodeFrame(html) {
  return html
    .split("\n")
    .map((line) =>
      /^\s*&gt;/.test(line)
        ? '<span style="display:inline-block; width:100%; margin:6px 0; ' +
          'color:#ff6b6b; background-color:rgba(255,107,107,0.12);">' +
          `${line}</span>`
        : line,
    )
    .join("\n");
}

/**
 * Highlight the file references webpack reports. The header reference (the one
 * with a `line:col` location, e.g. `./src/render.js 7:2`) is rendered as a file
 * chip; bare paths elsewhere are just underlined.
 * @param {string} html message HTML
 * @returns {string} HTML with file references styled
 */
function highlightFilePath(html) {
  return html.replace(
    /(\.{1,2}\/[\w./-]+\.\w+)(:\d+:\d+|\s\d+:\d+)?/g,
    (match, filePath, location) => {
      if (!location) {
        return (
          '<span style="color:#8dd6f9; text-decoration:underline; ' +
          `text-underline-offset:2px;">${match}</span>`
        );
      }

      return `<span style="color:#8dd6f9;">${filePath}</span>${location}\n`;
    },
  );
}

/**
 * Turn bare `http(s)` URLs in the message into clickable links.
 * @param {string} html message HTML
 * @returns {string} HTML with URLs wrapped in anchor tags
 */
function linkify(html) {
  return html.replace(/https?:\/\/[^\s<>"]+/g, (url) => {
    // Keep trailing punctuation (e.g. a sentence-ending dot) out of the href.
    const trailing = url.match(/[.,;:!?)\]}]+$/);
    const cut = trailing ? trailing[0] : "";
    const href = url.slice(0, url.length - cut.length);
    return (
      `<a href="${href}" target="_blank" rel="noopener noreferrer" ` +
      `style="color:#8dd6f9;">${href}</a>${cut}`
    );
  });
}

// Dismiss the overlay when pressing Escape while the page has focus.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clear();
  }
});

/**
 * Create (or return) the overlay iframe and the card inside it.
 * @returns {HTMLElement | null} the card element, or null when the frame
 * document is not available
 */
function ensureOverlay() {
  if (overlayFrame && overlayCard && overlayFrame.parentNode) {
    return overlayCard;
  }

  // Enable Trusted Types if they are available in the current browser.
  if (window.trustedTypes && !trustedTypesPolicy) {
    trustedTypesPolicy = window.trustedTypes.createPolicy(
      trustedTypesPolicyName || "webpack-dev-middleware#overlay",
      {
        createHTML: (value) => value,
      },
    );
  }

  overlayFrame = document.createElement("iframe");
  overlayFrame.id = OVERLAY_ID;
  overlayFrame.src = "about:blank";
  applyStyle(overlayFrame, backdropStyles);
  document.body.append(overlayFrame);

  // A same-origin `about:blank` document is available synchronously.
  const frameDocument = overlayFrame.contentDocument;

  if (!frameDocument || !frameDocument.body) {
    overlayFrame.remove();
    overlayFrame = null;

    return null;
  }

  applyStyle(frameDocument.body, bodyStyles);

  // Dismiss the overlay when pressing Escape while the frame has focus.
  frameDocument.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clear();
    }
  });

  // Dismiss the overlay when clicking the backdrop (but not the card itself).
  frameDocument.addEventListener("click", (event) => {
    if (
      overlayCard &&
      !overlayCard.contains(/** @type {EXPECTED_ANY} */ (event.target))
    ) {
      clear();
    }
  });

  // The card is the visible panel that holds the problem messages.
  overlayCard = frameDocument.createElement("div");
  overlayCard.id = CARD_ID;
  applyStyle(overlayCard, styles);
  frameDocument.body.append(overlayCard);

  return overlayCard;
}

/**
 * @param {"errors" | "warnings"} type problem type
 * @param {string[]} lines messages to render
 */
export function showProblems(type, lines) {
  const card = ensureOverlay();

  if (!card) {
    return;
  }

  const frameDocument = /** @type {Document} */ (
    /** @type {HTMLIFrameElement} */ (overlayFrame).contentDocument
  );

  // Accent the top bar with the problem color (red for errors, yellow for warnings).
  card.style.borderTopColor = `#${problemColor(type)}`;
  setHTML(card, "");

  // A close (×) button pinned to the top-right corner of the card.
  const closeButton = frameDocument.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close");
  applyStyle(closeButton, closeButtonStyles);
  closeButton.addEventListener("click", () => {
    clear();
  });
  card.append(closeButton);

  for (const line of lines) {
    const msg = linkify(
      highlightFilePath(highlightCodeFrame(ansiHTML(encodeHtmlEntity(line)))),
    );
    const div = frameDocument.createElement("div");
    div.style.marginBottom = "20px";
    setHTML(div, `${problemType(type)} in ${msg}`);
    normalizeInlineStyles(div);
    card.append(div);
  }

  const hint = frameDocument.createElement("div");
  applyStyle(hint, {
    marginTop: "4px",
    paddingTop: "16px",
    borderTop: "1px solid #465e69",
    color: "#999999",
    fontSize: "13px",
  });
  hint.textContent = "Click outside, press Esc, or fix the code to dismiss.";
  card.append(hint);
}

/**
 * Remove the overlay iframe from the DOM.
 */
export function clear() {
  if (overlayFrame && overlayFrame.parentNode) {
    overlayFrame.remove();
  }

  overlayFrame = null;
  overlayCard = null;
  runtimeMessages = [];
}

/**
 * @param {EXPECTED_ANY} error thrown value
 * @param {string} fallbackMessage message used when the thrown value is not an Error
 * @returns {string} printable message with stack
 */
function formatRuntimeError(error, fallbackMessage) {
  const errorObject =
    error instanceof Error ? error : new Error(error || fallbackMessage);
  const stack = errorObject.stack ? `\n${errorObject.stack}` : "";

  return `Uncaught runtime error: ${errorObject.message}${stack}`;
}

/**
 * @param {EXPECTED_ANY} error thrown value
 * @param {string} fallbackMessage fallback message
 */
function handleRuntimeError(error, fallbackMessage) {
  // If the error stack indicates a React error boundary caught the error, do
  // not show the overlay (same heuristic as webpack-dev-server).
  if (
    error &&
    error.stack &&
    error.stack.includes("invokeGuardedCallbackDev")
  ) {
    return;
  }

  runtimeMessages.push(formatRuntimeError(error, fallbackMessage));
  showProblems("errors", runtimeMessages);
}

/**
 * Listen for uncaught errors and unhandled rejections on the page.
 */
function attachRuntimeErrorListeners() {
  if (runtimeListenersAttached) {
    return;
  }

  runtimeListenersAttached = true;

  window.addEventListener("error", (event) => {
    if (!event.error && !event.message) {
      return;
    }

    handleRuntimeError(event.error, event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    handleRuntimeError(event.reason, "Unknown promise rejection reason");
  });
}

/**
 * @param {{ ansiColors?: Record<string, string | string[]>, overlayStyles?: Record<string, string | number>, trustedTypesPolicyName?: string, catchRuntimeError?: boolean }} options options
 * @returns {{ showProblems: typeof showProblems, clear: typeof clear }} overlay api
 */
export default function configureOverlay(options) {
  if (options.trustedTypesPolicyName) {
    trustedTypesPolicyName = options.trustedTypesPolicyName;
  }

  if (options.catchRuntimeError) {
    attachRuntimeErrorListeners();
  }

  if (options.ansiColors) {
    for (const color of Object.keys(options.ansiColors)) {
      if (color in colors) {
        colors[color] = options.ansiColors[color];
      }
    }
    ansiHTML.setColors(colors);
  }

  if (options.overlayStyles) {
    for (const style of Object.keys(options.overlayStyles)) {
      styles[style] = options.overlayStyles[style];
    }
  }

  if (overlayCard) {
    applyStyle(overlayCard, styles);
  }

  return {
    showProblems,
    clear,
  };
}
