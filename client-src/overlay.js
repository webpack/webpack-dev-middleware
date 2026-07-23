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
/** @type {boolean | ((error: Error) => boolean)} */
let catchRuntimeError = false;

// Pagination (wdm extension, enabled by default): the card shows one problem
// at a time with prev/next navigation.
let paginate = true;
let pageIndex = 0;
/** @type {{ type: "errors" | "warnings", lines: string[] } | null} */
let currentProblems = null;

// When set, the file chips in error messages become clickable and issue
// `GET <endpoint>?fileName=<file:line:column>`. The endpoint itself is
// provided by the server integration (e.g. a route that calls launch-editor,
// like webpack-dev-server's `/webpack-dev-server/open-editor`).
/** @type {string} */
let openEditorEndpoint = "";

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

      if (openEditorEndpoint) {
        const position = location.trim().replace(/^:/, "");

        return (
          '<span style="color:#8dd6f9; cursor:pointer; ' +
          'text-decoration:underline; text-underline-offset:2px;" ' +
          `data-open-file="${filePath}:${position}" ` +
          'title="Click to open in your editor">' +
          `${filePath}</span>${location}\n`
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

  // Dismiss the overlay when pressing Escape while the frame has focus;
  // navigate between problems with the arrow keys when paginating.
  frameDocument.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clear();
    } else if (paginate && event.key === "ArrowLeft") {
      goToPage(pageIndex - 1);
    } else if (paginate && event.key === "ArrowRight") {
      goToPage(pageIndex + 1);
    }
  });

  // Dismiss the overlay when clicking the backdrop (but not the card itself).
  frameDocument.addEventListener("click", (event) => {
    const target = /** @type {EXPECTED_ANY} */ (event.target);

    // Elements re-rendered away mid-dispatch (e.g. the pagination buttons)
    // are no longer inside the card — do not treat them as backdrop clicks.
    if (target && target.isConnected === false) {
      return;
    }

    if (overlayCard && !overlayCard.contains(target)) {
      clear();
    }
  });

  // Open the clicked file reference through the configured endpoint.
  frameDocument.addEventListener("click", (event) => {
    const target = /** @type {EXPECTED_ANY} */ (event.target);
    const opener =
      target && typeof target.closest === "function"
        ? target.closest("[data-open-file]")
        : null;

    if (opener && openEditorEndpoint) {
      fetch(
        `${openEditorEndpoint}?fileName=${encodeURIComponent(
          opener.getAttribute("data-open-file"),
        )}`,
      );
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
  // Re-publishing an identical set (e.g. another bundle of a multi-compiler
  // synced) must not reset the page the user is reading.
  const unchanged =
    currentProblems !== null &&
    overlayFrame !== null &&
    currentProblems.type === type &&
    currentProblems.lines.length === lines.length &&
    currentProblems.lines.every((line, index) => line === lines[index]);

  currentProblems = { type, lines };

  if (unchanged) {
    return;
  }

  // Each new problem set starts at its first page.
  pageIndex = 0;
  renderProblems();
}

/**
 * Clamp the page index and re-render.
 * @param {number} index requested page index
 */
function goToPage(index) {
  if (!currentProblems) {
    return;
  }

  pageIndex = Math.min(currentProblems.lines.length - 1, Math.max(0, index));
  renderProblems();
}

/**
 * Render the current problem set into the card.
 */
function renderProblems() {
  if (!currentProblems) {
    return;
  }

  const card = ensureOverlay();

  if (!card) {
    return;
  }

  const frameDocument = /** @type {Document} */ (
    /** @type {HTMLIFrameElement} */ (overlayFrame).contentDocument
  );
  const { type, lines } = currentProblems;
  const paginated = paginate && lines.length > 1;

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

  const visible = paginated ? [lines[pageIndex]] : lines;

  if (paginated) {
    // Header row: badge and the problem's first line (usually the file
    // reference) on the left, page navigation on the right (leaving room for
    // the absolute-positioned close button).
    const header = frameDocument.createElement("div");
    applyStyle(header, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      marginBottom: "16px",
      paddingRight: "28px",
    });

    const line = /** @type {string} */ (visible[0]);
    const newlineIndex = line.indexOf("\n");
    const title = newlineIndex === -1 ? line : line.slice(0, newlineIndex);

    const badge = frameDocument.createElement("span");
    applyStyle(badge, {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    setHTML(
      badge,
      `${problemType(type)} in ${linkify(
        highlightFilePath(ansiHTML(encodeHtmlEntity(title))),
      )}`,
    );
    normalizeInlineStyles(badge);

    const nav = frameDocument.createElement("div");
    applyStyle(nav, {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      fontSize: "13px",
      color: "#999999",
    });

    /**
     * @param {string} text button text
     * @param {number} delta page delta
     * @param {string} ariaLabel accessible label
     * @returns {HTMLButtonElement} nav button
     */
    const makeNavButton = (text, delta, ariaLabel) => {
      const button = frameDocument.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.setAttribute("aria-label", ariaLabel);
      applyStyle(button, {
        border: "none",
        background: "transparent",
        // Follow the problem color (red for errors, yellow for warnings).
        color: `#${problemColor(type)}`,
        cursor: "pointer",
        fontSize: "16px",
        lineHeight: "1",
        padding: "0",
      });
      button.addEventListener("click", () => {
        goToPage(pageIndex + delta);
      });
      return button;
    };

    const counter = frameDocument.createElement("span");
    counter.textContent = `${pageIndex + 1} / ${lines.length}`;
    applyStyle(counter, { color: "#f2f2f2" });

    nav.append(
      makeNavButton("‹", -1, "Previous problem"),
      counter,
      makeNavButton("›", 1, "Next problem"),
    );
    header.append(badge, nav);
    card.append(header);
  }

  for (const line of visible) {
    // When paginating, the first line (badge + file reference) already lives
    // in the header; render only the remainder.
    const newlineIndex = line.indexOf("\n");
    const body = paginated
      ? newlineIndex === -1
        ? ""
        : line.slice(newlineIndex + 1)
      : line;

    if (paginated && !body) {
      continue;
    }

    const msg = linkify(
      highlightFilePath(highlightCodeFrame(ansiHTML(encodeHtmlEntity(body)))),
    );
    const div = frameDocument.createElement("div");
    div.style.marginBottom = "20px";
    setHTML(div, paginated ? msg : `${problemType(type)} in ${msg}`);
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
  hint.textContent = paginated
    ? "Use ‹ › or the arrow keys to navigate. Click outside, press Esc, or fix the code to dismiss."
    : "Click outside, press Esc, or fix the code to dismiss.";
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
  currentProblems = null;
  pageIndex = 0;
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

  const errorObject =
    error instanceof Error ? error : new Error(error || fallbackMessage);

  // `catchRuntimeError` may be a filter function, like in webpack-dev-server.
  const shouldDisplay =
    typeof catchRuntimeError === "function"
      ? catchRuntimeError(errorObject)
      : true;

  if (!shouldDisplay) {
    return;
  }

  const stack = errorObject.stack ? `\n${errorObject.stack}` : "";

  runtimeMessages.push(
    `Uncaught runtime error: ${errorObject.message}${stack}`,
  );
  showProblems("errors", runtimeMessages);
  // When paginating, land on the newest runtime error.
  goToPage(runtimeMessages.length - 1);
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
 * @param {{ ansiColors?: Record<string, string | string[]>, overlayStyles?: Record<string, string | number>, trustedTypesPolicyName?: string, catchRuntimeError?: boolean | ((error: Error) => boolean), openEditorEndpoint?: string, paginate?: boolean }} options options
 * @returns {{ showProblems: typeof showProblems, clear: typeof clear }} overlay api
 */
export default function configureOverlay(options) {
  if (options.trustedTypesPolicyName) {
    trustedTypesPolicyName = options.trustedTypesPolicyName;
  }

  if (options.openEditorEndpoint !== undefined) {
    openEditorEndpoint = options.openEditorEndpoint;
  }

  if (options.paginate !== undefined) {
    paginate = Boolean(options.paginate);
  }

  if (options.catchRuntimeError !== undefined) {
    catchRuntimeError = options.catchRuntimeError;
  }

  if (catchRuntimeError) {
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
