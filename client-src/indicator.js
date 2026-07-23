// Small badge shown while a rebuild is in progress. It lives in a shadow root
// so page styles cannot affect it; styles go through the CSSOM and SVG
// presentation attributes, which a strict `style-src` CSP allows.

import theme from "./theme.js";

const INDICATOR_ID = "webpack-dev-middleware-building-indicator";
const SVG_NS = "http://www.w3.org/2000/svg";
// Circumference of the progress ring (r = 6).
const RING_LENGTH = 2 * Math.PI * 6;

/** @type {HTMLElement | null} */
let host = null;
/** @type {HTMLElement | null} */
let label = null;
/** @type {HTMLElement | null} */
let dot = null;
/** @type {SVGSVGElement | null} */
let ring = null;
/** @type {SVGCircleElement | null} */
let ringValue = null;

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

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
 * Create (or reuse) the indicator host element.
 */
function ensureIndicator() {
  if (host && host.parentNode) {
    return;
  }

  if (!document.body) {
    return;
  }

  host = document.createElement("div");
  host.id = INDICATOR_ID;
  applyStyle(host, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: 9999,
    pointerEvents: "none",
  });

  const root = host.attachShadow({ mode: "open" });

  const badge = document.createElement("div");
  applyStyle(badge, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: theme.panelTranslucent,
    color: theme.text,
    fontFamily: "Menlo, Consolas, 'Courier New', monospace",
    fontSize: "12px",
    padding: "6px 12px",
    borderRadius: "16px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
  });

  // Indeterminate mode: a pulsing dot.
  dot = document.createElement("span");
  applyStyle(dot, {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: theme.accent,
  });

  // Pulse through the Web Animations API — no <style> element involved.
  if (typeof dot.animate === "function") {
    dot.animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], {
      duration: 1000,
      iterations: Number.POSITIVE_INFINITY,
    });
  }

  // Determinate mode: a progress ring drawn with SVG presentation attributes.
  ring = document.createElementNS(SVG_NS, "svg");
  ring.setAttribute("viewBox", "0 0 16 16");
  applyStyle(ring, { width: "14px", height: "14px", display: "none" });

  const track = document.createElementNS(SVG_NS, "circle");
  track.setAttribute("cx", "8");
  track.setAttribute("cy", "8");
  track.setAttribute("r", "6");
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "rgba(255,255,255,0.25)");
  track.setAttribute("stroke-width", "2.5");

  ringValue = document.createElementNS(SVG_NS, "circle");
  ringValue.setAttribute("cx", "8");
  ringValue.setAttribute("cy", "8");
  ringValue.setAttribute("r", "6");
  ringValue.setAttribute("fill", "none");
  ringValue.setAttribute("stroke", theme.accent);
  ringValue.setAttribute("stroke-width", "2.5");
  ringValue.setAttribute("stroke-linecap", "round");
  ringValue.setAttribute("stroke-dasharray", String(RING_LENGTH));
  ringValue.setAttribute("stroke-dashoffset", String(RING_LENGTH));
  // Start the ring at 12 o'clock.
  ringValue.setAttribute("transform", "rotate(-90 8 8)");

  ring.append(track, ringValue);

  label = document.createElement("span");
  badge.append(dot, ring, label);
  root.append(badge);
  document.body.append(host);
}

/**
 * Show the indicator (idempotent). With a percent the badge renders a
 * progress ring; without one it renders a pulsing dot.
 * @param {string=} text label text
 * @param {number=} percent compilation progress (0-100)
 */
export function show(text, percent) {
  ensureIndicator();

  if (!label) {
    return;
  }

  label.textContent = text || "Rebuilding…";

  const determinate = typeof percent === "number";

  /** @type {HTMLElement} */ (dot).style.display = determinate
    ? "none"
    : "inline-block";
  /** @type {SVGSVGElement} */ (ring).style.display = determinate
    ? "block"
    : "none";

  if (determinate) {
    const clamped = Math.min(100, Math.max(0, percent));

    /** @type {SVGCircleElement} */ (ringValue).setAttribute(
      "stroke-dashoffset",
      String(RING_LENGTH * (1 - clamped / 100)),
    );
  }
}

/**
 * Remove the indicator from the page.
 */
export function hide() {
  if (host && host.parentNode) {
    host.remove();
  }

  host = null;
  label = null;
  dot = null;
  ring = null;
  ringValue = null;
}
