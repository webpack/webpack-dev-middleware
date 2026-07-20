import stripAnsi from "../client-src/utils/strip-ansi";

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

describe("stripAnsi", () => {
  it("strips color sequences", () => {
    expect(stripAnsi(`${ESC}[31mred${ESC}[39m plain`)).toBe("red plain");
  });

  it("strips style and background sequences", () => {
    expect(stripAnsi(`${ESC}[1m${ESC}[42mbold-bg${ESC}[0m`)).toBe("bold-bg");
  });

  it("strips 256-color sequences", () => {
    expect(stripAnsi(`${ESC}[38;5;196mred${ESC}[0m`)).toBe("red");
  });

  it("strips cursor and erase sequences", () => {
    expect(stripAnsi(`${ESC}[2K${ESC}[1A${ESC}[2K${ESC}[G`)).toBe("");
  });

  it("strips terminal hyperlinks", () => {
    expect(
      stripAnsi(`${ESC}]8;;https://example.com${BEL}link${ESC}]8;;${BEL}`),
    ).toBe("link");
  });

  it("keeps plain strings untouched", () => {
    expect(stripAnsi("no ansi at all")).toBe("no ansi at all");
  });

  it("strips ansi from a webpack-style error line", () => {
    expect(
      stripAnsi(
        `webpack ${ESC}[1m${ESC}[31mERROR${ESC}[39m${ESC}[22m in ./src/index.js 3:10`,
      ),
    ).toBe("webpack ERROR in ./src/index.js 3:10");
  });
});
