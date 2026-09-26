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
 * @typedef {"circular" | "linear"} IndicatorType
 */

/**
 * @typedef {object} IndicatorState
 * @property {HTMLElement | null} host badge host element
 * @property {IndicatorType} type which indicator is rendered
 * @property {HTMLElement | null} label label inside the badge
 * @property {HTMLElement | null} dot pulsing dot (indeterminate mode)
 * @property {SVGSVGElement | null} ring progress ring (determinate mode)
 * @property {SVGCircleElement | null} ringValue ring value circle
 * @property {HTMLElement | null} bar filled part of the linear indicator
 * @property {EXPECTED_ANY} barAnimation the bar's sweep, when one is running
 * @property {EXPECTED_ANY[]} animations every running animation, so motion can be stopped on request
 * @property {EXPECTED_ANY} motionListener what watches for motion being declined mid-build
 * @property {Record<string, true>} building sources with a build in progress — the badge hides only when every source finished
 */

/** @returns {IndicatorState} fresh indicator state */
function createIndicatorState() {
  return {
    host: null,
    type: "circular",
    label: null,
    dot: null,
    ring: null,
    ringValue: null,
    bar: null,
    barAnimation: null,
    animations: [],
    motionListener: null,
    building: {},
  };
}

// Shared through `window` so every bundled copy of this module drives one
// single badge instead of stacking duplicates (same pattern as the overlay).
const INDICATOR_STATE_KEY = "__webpack_dev_middleware_hot_indicator_state__";

/** @type {IndicatorState} */
const state = (() => {
  // The browser suite cannot produce a document-less environment; this is the
  // guard for a server-side import of the bundle.
  /* istanbul ignore next -- @preserve */
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
 * @returns {EXPECTED_ANY} the reduced-motion query, or null where there is none
 */
function motionQuery() {
  /* istanbul ignore next -- @preserve */
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

/**
 * Stop every animation this module started, and stop listening for the
 * preference that would have stopped them.
 */
function stopAnimations() {
  for (const animation of state.animations) {
    animation.cancel();
  }

  state.animations = [];

  const query = motionQuery();

  if (query && state.motionListener) {
    if (typeof query.removeEventListener === "function") {
      query.removeEventListener("change", state.motionListener);
    } else if (typeof query.removeListener === "function") {
      query.removeListener(state.motionListener);
    }
  }

  state.motionListener = null;
}

/**
 * Start a looping animation, unless the viewer asked not to see motion — and
 * stop it if they ask while it is running. Every animation started this way is
 * tracked, so `hide` can stop them and drop the listener with them.
 * @param {EXPECTED_ANY} element what to animate
 * @param {EXPECTED_ANY} keyframes keyframes
 * @param {EXPECTED_ANY} options animation options
 * @returns {EXPECTED_ANY} the animation, or null when none was started
 */
function animate(element, keyframes, options) {
  const query = motionQuery();

  if ((query && query.matches) || typeof element.animate !== "function") {
    return null;
  }

  const animation = element.animate(keyframes, options);

  state.animations.push(animation);

  // Asked for mid-build: stop what is already moving rather than wait it out.
  if (query && !state.motionListener) {
    state.motionListener = () => {
      if (query.matches) {
        stopAnimations();
      }
    };

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", state.motionListener);
    } else if (typeof query.addListener === "function") {
      // Safari below 14 has only the deprecated spelling.
      query.addListener(state.motionListener);
    }
  }

  return animation;
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
 * Build the linear indicator: a thin bar across the top of the viewport, the
 * shape `progress: "linear"` selects in webpack-dev-server.
 * @param {ShadowRoot} root the host's shadow root
 */
function buildBar(root) {
  applyStyle(/** @type {HTMLElement} */ (state.host), {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "4px",
    zIndex: 2147483645,
    pointerEvents: "none",
  });

  state.bar = document.createElement("div");
  applyStyle(state.bar, {
    width: "0%",
    height: "4px",
    background: theme.accent,
  });

  root.appendChild(state.bar);
}

/**
 * Create (or reuse) the indicator host element.
 */
function ensureIndicator() {
  if (state.host && state.host.parentNode) {
    return;
  }

  // Only reachable from a script running before <body> exists.
  /* istanbul ignore next -- @preserve */
  if (!document.body) {
    return;
  }

  state.host = document.createElement("div");
  state.host.id = INDICATOR_ID;

  const root = state.host.attachShadow({ mode: "open" });

  if (state.type === "linear") {
    buildBar(root);
    document.body.appendChild(state.host);

    return;
  }

  applyStyle(state.host, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: 9999,
    pointerEvents: "none",
  });

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
  animate(state.dot, [{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], {
    duration: 1000,
    iterations: Number.POSITIVE_INFINITY,
  });

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

  state.ring.appendChild(track);
  state.ring.appendChild(state.ringValue);

  state.label = document.createElement("span");
  badge.appendChild(state.dot);
  badge.appendChild(state.ring);
  badge.appendChild(state.label);
  root.appendChild(badge);
  document.body.appendChild(state.host);
}

/**
 * Drive the linear indicator. A percent sets the width; without one there is
 * nothing to measure, so the bar sweeps instead — the same choice the badge
 * makes between its ring and its pulsing dot.
 * @param {number=} percent compilation progress (0-100)
 */
function showBar(percent) {
  // Built by `ensureIndicator`, so missing only in the document-less case it
  // already guards.
  /* istanbul ignore next -- @preserve */
  if (!state.bar) {
    return;
  }

  if (typeof percent === "number") {
    if (state.barAnimation) {
      stopAnimations();
      state.barAnimation = null;
    }

    state.bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;

    return;
  }

  if (state.barAnimation) {
    return;
  }

  // Web Animations rather than a stylesheet: a strict `style-src` refuses a
  // `<style>` element, which is why nothing here has one. With motion declined
  // nothing sweeps, so the bar states that a build is running by sitting still
  // at full width instead.
  state.barAnimation = animate(
    state.bar,
    [{ transform: "translateX(-100%)" }, { transform: "translateX(250%)" }],
    { duration: 1400, iterations: Number.POSITIVE_INFINITY },
  );
  state.bar.style.width = state.barAnimation ? "40%" : "100%";
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

  if (state.type === "linear") {
    showBar(percent);

    return;
  }

  // `ensureIndicator` above builds the label, so it is missing only in the
  // document-less case that function already guards.
  /* istanbul ignore next -- @preserve */
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

  stopAnimations();
  state.barAnimation = null;

  if (state.host && state.host.parentNode) {
    /** @type {ParentNode & Node} */
    (state.host.parentNode).removeChild(state.host);
  }

  state.host = null;
  state.label = null;
  state.dot = null;
  state.ring = null;
  state.ringValue = null;
  state.bar = null;
  state.building = {};
}

/**
 * Choose which indicator is rendered. `"circular"` is the badge this package
 * has always shown; `"linear"` is the thin bar across the top of the viewport,
 * so `progress` can carry the same values as webpack-dev-server's.
 * @param {IndicatorType} type which indicator to render
 */
export function configure(type) {
  if (type === state.type) {
    return;
  }

  state.type = type;

  // The two are different elements, so anything already on screen has to go;
  // the next event rebuilds in the new shape. Which sources are mid-build is
  // kept, so the indicator still hides only once they have all finished.
  if (state.host) {
    const building = state.building;

    hide();
    state.building = building;
  }
}
