// Small badge shown while a rebuild is in progress. It lives in a shadow root
// so page styles cannot affect it; styles go through the CSSOM and SVG
// presentation attributes, which a strict `style-src` CSP allows.

import theme from "./theme.js";

const INDICATOR_ID = "webpack-dev-middleware-building-indicator";
const SVG_NS = "http://www.w3.org/2000/svg";
// Circumference of the progress ring (r = 6).
const RING_LENGTH = 2 * Math.PI * 6;

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/**
 * @typedef {object} IndicatorState
 * @property {HTMLElement | null} host badge host element
 * @property {HTMLElement | null} label label inside the badge
 * @property {HTMLElement | null} dot pulsing dot (indeterminate mode)
 * @property {SVGSVGElement | null} ring progress ring (determinate mode)
 * @property {SVGCircleElement | null} ringValue ring value circle
 * @property {Record<string, true>} building sources with a build in progress — the badge hides only when every source finished
 */

/** @returns {IndicatorState} fresh indicator state */
function createIndicatorState() {
  return {
    host: null,
    label: null,
    dot: null,
    ring: null,
    ringValue: null,
    building: {},
  };
}

// Shared through `window` so every bundled copy of this module drives one
// single badge instead of stacking duplicates (same pattern as the overlay).
const INDICATOR_STATE_KEY = "__webpack_dev_middleware_hot_indicator_state__";

/** @type {IndicatorState} */
const state = (() => {
  if (typeof window === "undefined") {
    return createIndicatorState();
  }

  const holder = /** @type {EXPECTED_ANY} */ (window);

  if (!holder[INDICATOR_STATE_KEY]) {
    holder[INDICATOR_STATE_KEY] = createIndicatorState();
  } else {
    // Fill fields another package version may not have created, in place.
    const defaults = createIndicatorState();

    for (const key of Object.keys(defaults)) {
      if (!(key in holder[INDICATOR_STATE_KEY])) {
        holder[INDICATOR_STATE_KEY][key] =
          defaults[/** @type {keyof IndicatorState} */ (key)];
      }
    }
  }

  return holder[INDICATOR_STATE_KEY];
})();

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
  if (state.host && state.host.parentNode) {
    return;
  }

  if (!document.body) {
    return;
  }

  state.host = document.createElement("div");
  state.host.id = INDICATOR_ID;
  applyStyle(state.host, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: 9999,
    pointerEvents: "none",
  });

  const root = state.host.attachShadow({ mode: "open" });

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
  state.dot = document.createElement("span");
  applyStyle(state.dot, {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: theme.accent,
  });

  // Pulse through the Web Animations API — no <style> element involved.
  if (typeof state.dot.animate === "function") {
    state.dot.animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], {
      duration: 1000,
      iterations: Number.POSITIVE_INFINITY,
    });
  }

  // Determinate mode: a progress ring drawn with SVG presentation attributes.
  state.ring = document.createElementNS(SVG_NS, "svg");
  state.ring.setAttribute("viewBox", "0 0 16 16");
  applyStyle(state.ring, { width: "14px", height: "14px", display: "none" });

  const track = document.createElementNS(SVG_NS, "circle");
  track.setAttribute("cx", "8");
  track.setAttribute("cy", "8");
  track.setAttribute("r", "6");
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "rgba(255,255,255,0.25)");
  track.setAttribute("stroke-width", "2.5");

  state.ringValue = document.createElementNS(SVG_NS, "circle");
  state.ringValue.setAttribute("cx", "8");
  state.ringValue.setAttribute("cy", "8");
  state.ringValue.setAttribute("r", "6");
  state.ringValue.setAttribute("fill", "none");
  state.ringValue.setAttribute("stroke", theme.accent);
  state.ringValue.setAttribute("stroke-width", "2.5");
  state.ringValue.setAttribute("stroke-linecap", "round");
  state.ringValue.setAttribute("stroke-dasharray", String(RING_LENGTH));
  state.ringValue.setAttribute("stroke-dashoffset", String(RING_LENGTH));
  // Start the ring at 12 o'clock.
  state.ringValue.setAttribute("transform", "rotate(-90 8 8)");

  state.ring.append(track, state.ringValue);

  state.label = document.createElement("span");
  badge.append(state.dot, state.ring, state.label);
  root.append(badge);
  document.body.append(state.host);
}

/**
 * Show the indicator (idempotent). With a percent the badge renders a
 * progress ring; without one it renders a pulsing dot.
 * @param {string=} text label text
 * @param {number=} percent compilation progress (0-100)
 * @param {string=} source who is building (e.g. a compilation name, or a
 * client sharing the badge) — the badge stays until every source finished
 */
export function show(text, percent, source = "") {
  state.building[source] = true;
  ensureIndicator();

  if (!state.label) {
    return;
  }

  state.label.textContent = text || "Rebuilding…";

  const determinate = typeof percent === "number";

  /** @type {HTMLElement} */ (state.dot).style.display = determinate
    ? "none"
    : "inline-block";
  /** @type {SVGSVGElement} */ (state.ring).style.display = determinate
    ? "block"
    : "none";

  if (determinate) {
    const clamped = Math.min(100, Math.max(0, percent));

    /** @type {SVGCircleElement} */ (state.ringValue).setAttribute(
      "stroke-dashoffset",
      String(RING_LENGTH * (1 - clamped / 100)),
    );
  }
}

/**
 * Mark one source's build as finished, or remove the indicator entirely.
 * @param {string=} source when given, only that source is dropped and the
 * badge stays while any other source is still building; without it the badge
 * is removed unconditionally
 */
export function hide(source) {
  if (source !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(state.building, source)) {
      return;
    }

    delete state.building[source];

    if (Object.keys(state.building).length > 0) {
      return;
    }
  }

  if (state.host && state.host.parentNode) {
    state.host.remove();
  }

  state.host = null;
  state.label = null;
  state.dot = null;
  state.ring = null;
  state.ringValue = null;
  state.building = {};
}
