import ansiHTML, { setColors } from "../client-src/utils/ansi-html";

const E = "\u001B";

// Named, so a case reads as what it is rather than as a run of escapes — and
// so no code sits flush against the text it colours.
const BOLD = `${E}[1m`;
const NO_BOLD = `${E}[22m`;
const RED = `${E}[31m`;
const YELLOW = `${E}[33m`;
const GREY = `${E}[90m`;
const RED_BG = `${E}[41m`;
const NO_COLOR = `${E}[39m`;
const NO_BG = `${E}[49m`;
const RESET = `${E}[0m`;
const RESET_SHORT = `${E}[m`;
const INVERSE = `${E}[7m`;
const NO_INVERSE = `${E}[27m`;
const BOLD_RED = `${E}[1;31m`;
const UNKNOWN = `${E}[99m`;
const ITALIC = `${E}[3m`;
const NO_ITALIC = `${E}[23m`;
const UNDER = `${E}[4m`;
const NO_UNDER = `${E}[24m`;
const STRIKE = `${E}[9m`;
const NO_STRIKE = `${E}[29m`;

// The palette the overlay uses. `reset` is `"transparent"` twice, which is how
// a palette says to leave the page's own colours alone.
const PALETTE = {
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

// A loader colours its output, and those sequences travel in the error's
// message all the way to the overlay. This is the one part of the overlay with
// real edge cases — nesting, a sequence that never closes — and it had no test
// of its own while it was a dependency.
describe("ansi colours as html", () => {
  beforeEach(() => {
    setColors(PALETTE);
  });

  it("leaves text with no escapes exactly as it is", () => {
    expect(ansiHTML("nothing to colour here")).toBe("nothing to colour here");
  });

  it("colours a foreground sequence", () => {
    expect(ansiHTML(`a ${RED}red${NO_COLOR} b`)).toBe(
      'a <span style="color:#ff3348;">red</span> b',
    );
  });

  it("nests a weight inside a colour", () => {
    // What babel-loader actually emits: bold, then red, then each closed.
    expect(ansiHTML(`${BOLD}${RED}boom${NO_COLOR}${NO_BOLD} tail`)).toBe(
      '<span style="font-weight:bold;">' +
        '<span style="color:#ff3348;">boom</span></span> tail',
    );
  });

  it("colours a background", () => {
    expect(ansiHTML(`${RED_BG}bg${NO_BG}`)).toBe(
      '<span style="background:#ff3348;">bg</span>',
    );
  });

  it("uses the palette's own grey for the dim colour", () => {
    expect(ansiHTML(`${GREY}dim${NO_COLOR}`)).toBe(
      '<span style="color:#6d7891;">dim</span>',
    );
  });

  it("opens the tags that are tags rather than styles", () => {
    expect(
      ansiHTML(
        `${ITALIC}i${NO_ITALIC} ${UNDER}u${NO_UNDER} ${STRIKE}d${NO_STRIKE}`,
      ),
    ).toBe("<i>i</i> <u>u</u> <del>d</del>");
  });

  it("closes what a sequence left open", () => {
    // Otherwise the span leaks into the rest of the card.
    expect(ansiHTML(`${RED}unclosed`)).toBe(
      '<span style="color:#ff3348;">unclosed</span>',
    );
  });

  it("drops a parameter it has nothing for", () => {
    expect(ansiHTML(`${UNKNOWN}unknown${NO_COLOR}`)).toBe("unknown");
  });

  it("closes nothing when a sequence repeats itself", () => {
    // The second `31` closes the span the first opened, so the `39` that
    // follows has nothing left to close. The package emitted its `</span>`
    // regardless, leaving an unmatched tag in the middle of the message.
    expect(ansiHTML(`${RED}a${RED}b${NO_COLOR}c`)).toBe(
      '<span style="color:#ff3348;">a</span>bc',
    );
  });

  it("leaves an escape that is not a colour alone", () => {
    // A screen clear is not this function's business, and mangling it would
    // put an escape in front of the reader.
    expect(ansiHTML(`before ${E}[2J after`)).toBe(`before ${E}[2J after`);
  });

  // The palette says `"transparent"`, which is not a colour. Written into a
  // hex slot it produced `color:#transparent`, and the overlay's reset worked
  // only because a browser drops an invalid declaration.
  it("leaves out a declaration the palette has no colour for", () => {
    expect(ansiHTML(`${YELLOW}warn${RESET} after`)).toBe(
      '<span style="color:#ffd30e;">warn' +
        '<span style="font-weight:normal;opacity:1;"> after</span></span>',
    );
  });

  it("opens a span with no style at all rather than an empty one", () => {
    // Inverse swaps the reset pair, and this palette has no colour in it.
    expect(ansiHTML(`${INVERSE}inverse${NO_INVERSE}`)).toBe(
      "<span>inverse</span>",
    );
  });

  // One sequence can carry several parameters. It used to match nothing, so
  // the escape stayed in the output for the reader to see.
  it("applies every parameter of one sequence", () => {
    expect(ansiHTML(`${BOLD_RED}both${RESET}`)).toBe(
      '<span style="font-weight:bold;"><span style="color:#ff3348;">both' +
        '<span style="font-weight:normal;opacity:1;"></span></span></span>',
    );
  });

  it("reads an empty parameter as a reset", () => {
    // `\u001b[m` is how `\u001b[0m` is written short.
    expect(ansiHTML(`${RESET_SHORT}reset`)).toBe(
      '<span style="font-weight:normal;opacity:1;">reset</span>',
    );
  });

  describe("with a palette of its own", () => {
    it("takes a hex colour without its hash", () => {
      setColors({ ...PALETTE, red: "00ff00" });

      expect(ansiHTML(`${RED}green now${NO_COLOR}`)).toBe(
        '<span style="color:#00ff00;">green now</span>',
      );
    });

    it("takes a colour that is not hex as it is written", () => {
      // The `#` is only added back to a hex value, so anything else a palette
      // carries reaches the style as it was given.
      setColors({ ...PALETTE, red: "rgb(1 2 3)" });

      expect(ansiHTML(`${RED}written${NO_COLOR}`)).toBe(
        '<span style="color:rgb(1 2 3);">written</span>',
      );
    });

    it("takes a reset colour, when the palette names one", () => {
      setColors({ ...PALETTE, reset: ["ffffff", "000000"] });

      expect(ansiHTML(`${RESET}reset`)).toBe(
        '<span style="font-weight:normal;opacity:1;color:#ffffff;background:#000000;">reset</span>',
      );
    });

    it("takes a reset given as one colour", () => {
      setColors({ ...PALETTE, reset: "ffffff" });

      expect(ansiHTML(`${RESET}reset`)).toBe(
        '<span style="font-weight:normal;opacity:1;color:#ffffff;">reset</span>',
      );
    });

    it("falls back to black for a colour the palette left out", () => {
      setColors({ reset: ["transparent", "transparent"] });

      expect(ansiHTML(`${RED}no red${NO_COLOR}`)).toBe(
        '<span style="color:#000;">no red</span>',
      );
    });
  });
});
