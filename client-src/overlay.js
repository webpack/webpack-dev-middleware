import ansiHTML from "ansi-html-community";
import { encode as encodeHtmlEntity } from "html-entities";

const clientOverlay = document.createElement("div");
clientOverlay.id = "webpack-dev-middleware-hot-overlay";

/** @type {Record<string, string | number>} */
const styles = {
  background: "rgba(0,0,0,0.85)",
  color: "#e8e8e8",
  lineHeight: "1.6",
  whiteSpace: "pre",
  fontFamily: "Menlo, Consolas, monospace",
  fontSize: "13px",
  position: "fixed",
  zIndex: 9999,
  padding: "10px",
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  overflow: "auto",
  dir: "ltr",
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
 * @returns {string} HTML span with a colored badge
 */
function problemType(type) {
  /** @type {Record<string, string | string[]>} */
  const problemColors = {
    errors: colors.red,
    warnings: colors.yellow,
  };
  const color = problemColors[type] || colors.red;
  return (
    `<span style="background-color:#${color}; color:#000000; ` +
    'padding:3px 6px; border-radius: 4px;">' +
    `${type.slice(0, -1).toUpperCase()}</span>`
  );
}

/**
 * @param {"errors" | "warnings"} type problem type
 * @param {string[]} lines messages to render
 */
export function showProblems(type, lines) {
  clientOverlay.innerHTML = "";
  for (const line of lines) {
    const msg = ansiHTML(encodeHtmlEntity(line));
    const div = document.createElement("div");
    div.style.marginBottom = "26px";
    div.innerHTML = `${problemType(type)} in ${msg}`;
    clientOverlay.append(div);
  }
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

  for (const key of Object.keys(styles)) {
    /** @type {EXPECTED_ANY} */
    (clientOverlay.style)[key] = styles[key];
  }

  return {
    showProblems,
    clear,
  };
}

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */
