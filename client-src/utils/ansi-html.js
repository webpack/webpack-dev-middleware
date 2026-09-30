// ANSI colours to HTML, for the overlay.
//
// Inlined from `ansi-html-community`, whose last release was 0.0.8 in April
// 2022 and which is itself a fork of the abandoned `ansi-html`. A third of it
// was surface this project never touched — the `tags` getters, a `reset()`
// nobody called, and the validation branches that a fixed palette cannot
// reach — and it shipped into every consumer's browser bundle.
//
// Two things are different from that package, both deliberate, both covered by
// `test/ansi-html.test.js`:
//
//   * A palette entry of `"transparent"` leaves the declaration out rather
//     than writing `color:#transparent`, which is not a colour. Browsers drop
//     an invalid declaration, so the reset worked by accident; it now says
//     what it means.
//   * A sequence carrying more than one parameter (`\u001b[1;31m`) is applied
//     parameter by parameter. It used to match nothing, so the escape stayed
//     in the output as text for the reader to see.
//
// Compiled to an ES5 baseline like the rest of the browser runtime.

// One SGR sequence: `\u001b[`, the parameters, then `m`. Other escapes (cursor
// moves, screen clears) are left exactly as they came, the way they were
// before.
// eslint-disable-next-line no-control-regex
const SGR = /\u001B\[([0-9;]*)m/g;

// Which colour each foreground parameter names. The background parameter is
// this plus ten, which is what the loop below relies on.
/** @type {Record<string, string>} */
const FOREGROUND = {
  30: "black",
  31: "red",
  32: "green",
  33: "yellow",
  34: "blue",
  35: "magenta",
  36: "cyan",
  37: "lightgrey",
};

// What each parameter opens, where it is not a colour.
/** @type {Record<string, string>} */
const STATIC_OPEN = {
  1: "font-weight:bold",
  2: "opacity:0.5",
  3: "<i>",
  4: "<u>",
  8: "display:none",
  9: "<del>",
};

// ... and what closes one. The rest close whatever span is open.
/** @type {Record<string, string>} */
const STATIC_CLOSE = {
  23: "</i>",
  24: "</u>",
  29: "</del>",
};

const CLOSES_SPAN = [0, 21, 22, 27, 28, 39, 49];

/** @type {Record<string, string>} */
let openTags = {};
/** @type {Record<string, string>} */
let closeTags = {};

/**
 * One colour declaration, or nothing at all.
 *
 * A palette carries a hex colour without its `#`, so one is added back. Any
 * other value is used as it is, and `"transparent"` — which is how a palette
 * says to leave the page's own colour alone — produces no declaration rather
 * than an invalid one.
 * @param {string} property `color` or `background`
 * @param {string | undefined} value the palette's value
 * @returns {string} the declaration, or an empty string
 */
function colorDeclaration(property, value) {
  if (!value || value === "transparent") {
    return "";
  }

  return `${property}:${/^[\da-f]{3,8}$/i.test(value) ? `#${value}` : value}`;
}

/**
 * Join the declarations that have something in them.
 * @param {string[]} declarations css declarations
 * @returns {string} the style
 */
function style(declarations) {
  const kept = [];

  for (let index = 0; index < declarations.length; index++) {
    if (declarations[index]) {
      kept.push(declarations[index]);
    }
  }

  return kept.join(";");
}

/**
 * Build the tag tables from a palette.
 * @param {Record<string, string | string[]>} colors palette, hex without `#`
 */
export function setColors(colors) {
  /** @type {Record<string, string>} */
  const open = {};
  /** @type {Record<string, string>} */
  const close = {};

  for (const parameter of Object.keys(STATIC_OPEN)) {
    open[parameter] = STATIC_OPEN[parameter];
  }

  for (const parameter of Object.keys(STATIC_CLOSE)) {
    close[parameter] = STATIC_CLOSE[parameter];
  }

  for (let index = 0; index < CLOSES_SPAN.length; index++) {
    close[CLOSES_SPAN[index]] = "</span>";
  }

  const reset = Array.isArray(colors.reset)
    ? colors.reset
    : [/** @type {string} */ (colors.reset)];
  const [foreground, background] = reset;

  // Reset: back to the page's weight and opacity, and to whichever colours the
  // palette names for it.
  open[0] = style([
    "font-weight:normal",
    "opacity:1",
    colorDeclaration("color", foreground),
    colorDeclaration("background", background),
  ]);

  // Inverse: the reset pair, the other way round.
  open[7] = style([
    colorDeclaration("color", background),
    colorDeclaration("background", foreground),
  ]);

  open[90] = style([
    colorDeclaration("color", /** @type {string} */ (colors.darkgrey)),
  ]);

  for (const parameter of Object.keys(FOREGROUND)) {
    const color = /** @type {string} */ (
      colors[FOREGROUND[parameter]] || "000"
    );

    open[parameter] = style([colorDeclaration("color", color)]);
    open[Number(parameter) + 10] = style([
      colorDeclaration("background", color),
    ]);
  }

  openTags = open;
  closeTags = close;
}

/**
 * Apply one SGR parameter.
 * @param {string} parameter the parameter, as it was written
 * @param {string[]} stack parameters whose span is still open
 * @returns {string} what it becomes
 */
function applyParameter(parameter, stack) {
  const open = openTags[parameter];

  // An empty style is still a tag to open: the stack has to stay balanced, or
  // a later close would end the wrong span.
  if (typeof open !== "undefined") {
    // Already open, so this closes it — what the package did, kept.
    if (stack.indexOf(parameter) !== -1) {
      stack.pop();

      return "</span>";
    }

    stack.push(parameter);

    if (open.charAt(0) === "<") {
      return open;
    }

    // A palette can leave a parameter with nothing to declare — inverse, with
    // a reset pair of `"transparent"`. The span still opens, to keep the stack
    // balanced, but without an empty style attribute to carry.
    return open === "" ? "<span>" : `<span style="${open};">`;
  }

  const close = closeTags[parameter];

  if (typeof close !== "undefined") {
    // Nothing open is nothing to close. The package emitted the tag anyway,
    // which put an unmatched `</span>` into the card — and the highlighters
    // run after this and wrap their own spans around it, so a stray close
    // could end one of theirs early.
    if (stack.length === 0) {
      return "";
    }

    stack.pop();

    return close;
  }

  return "";
}

/**
 * Turn the ANSI colours in some text into HTML.
 * @param {string} text text that may carry SGR sequences
 * @returns {string} the text, with its colours as markup
 */
export default function ansiHTML(text) {
  // Nothing to do, and nothing to scan: a message without an escape in it is
  // most messages.
  if (text.indexOf("\u001B") === -1) {
    return text;
  }

  /** @type {string[]} */
  const stack = [];
  let result = text.replace(SGR, (match, parameters) => {
    // `\u001b[m` is `\u001b[0m` written short.
    const each = (parameters === "" ? "0" : parameters).split(";");
    let out = "";

    for (let index = 0; index < each.length; index++) {
      out += applyParameter(each[index], stack);
    }

    return out;
  });

  // Whatever is still open, closed, so the markup cannot leak into the rest of
  // the card.
  for (let index = 0; index < stack.length; index++) {
    result += "</span>";
  }

  return result;
}
