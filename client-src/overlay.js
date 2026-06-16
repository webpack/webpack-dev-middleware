import ansiHTML from "ansi-html-community";
import { encode as encodeHtmlEntity } from "html-entities";

// The backdrop dims the page and centers the error card.
const clientOverlay = document.createElement("div");
clientOverlay.id = "webpack-dev-middleware-hot-overlay";

// The card is the visible panel that holds the problem messages.
const overlayCard = document.createElement("div");
clientOverlay.append(overlayCard);

// A close (×) button pinned to the top-right corner of the card.
const closeButton = document.createElement("button");
closeButton.type = "button";
closeButton.textContent = "×";
closeButton.setAttribute("aria-label", "Close");
closeButton.style.position = "absolute";
closeButton.style.top = "8px";
closeButton.style.right = "12px";
closeButton.style.border = "none";
closeButton.style.background = "transparent";
closeButton.style.color = "#999999";
closeButton.style.fontSize = "22px";
closeButton.style.lineHeight = "1";
closeButton.style.cursor = "pointer";
closeButton.style.padding = "0";
closeButton.addEventListener("click", () => {
  clear();
});

// Dismiss the overlay when clicking the backdrop (but not the card itself).
clientOverlay.addEventListener("click", (event) => {
  if (event.target === clientOverlay) {
    clear();
  }
});

// Dismiss the overlay when pressing Escape.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clear();
  }
});

/** @type {Record<string, string | number>} */
const backdropStyles = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9999,
  // webpack "Outer Space" (#2B3A42), translucent.
  background: "rgba(43,58,66,0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px",
  boxSizing: "border-box",
  overflow: "auto",
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

/**
 * @param {"errors" | "warnings"} type problem type
 * @param {string[]} lines messages to render
 */
export function showProblems(type, lines) {
  // Accent the top bar with the problem color (red for errors, yellow for warnings).
  overlayCard.style.borderTopColor = `#${problemColor(type)}`;
  overlayCard.innerHTML = "";
  overlayCard.append(closeButton);
  for (const line of lines) {
    const msg = linkify(
      highlightFilePath(highlightCodeFrame(ansiHTML(encodeHtmlEntity(line)))),
    );
    const div = document.createElement("div");
    div.style.marginBottom = "20px";
    div.innerHTML = `${problemType(type)} in ${msg}`;
    overlayCard.append(div);
  }

  const hint = document.createElement("div");
  hint.style.marginTop = "4px";
  hint.style.paddingTop = "16px";
  hint.style.borderTop = "1px solid #465e69";
  hint.style.color = "#999999";
  hint.style.fontSize = "13px";
  hint.textContent = "Click outside, press Esc, or fix the code to dismiss.";
  overlayCard.append(hint);

  if (document.body) {
    document.body.append(clientOverlay);
  }
}

/**
 * Remove the overlay container from the DOM.
 */
export function clear() {
  if (clientOverlay.parentNode) {
    clientOverlay.remove();
  }
}

/**
 * @param {{ ansiColors?: Record<string, string | string[]>, overlayStyles?: Record<string, string | number> }} options options
 * @returns {{ showProblems: typeof showProblems, clear: typeof clear }} overlay api
 */
export default function configureOverlay(options) {
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

  for (const key of Object.keys(backdropStyles)) {
    /** @type {EXPECTED_ANY} */
    (clientOverlay.style)[key] = backdropStyles[key];
  }

  for (const key of Object.keys(styles)) {
    /** @type {EXPECTED_ANY} */
    (overlayCard.style)[key] = styles[key];
  }

  return {
    showProblems,
    clear,
  };
}

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */
