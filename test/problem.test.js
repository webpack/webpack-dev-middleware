import {
  formatProblem,
  problemBody,
  problemLine,
  problemLocation,
} from "../client-src/problem";

// What a problem reads as. The middleware formats its own payloads on the
// server, so these are for a server that sends webpack's error objects to the
// browser instead — and the two have to agree, or the same build reads
// differently depending on who formatted it.
describe("where a problem happened", () => {
  it("names the module and the position in it", () => {
    expect(problemLocation({ moduleName: "./src/app.js", loc: "3:0" })).toBe(
      "./src/app.js 3:0",
    );
  });

  it("puts the module first and the loaders that built it after", () => {
    // `moduleName` is the whole request when loaders were involved, and the
    // chain reads as noise where the file is what matters.
    expect(
      problemLocation({
        moduleName: "babel-loader!./src/app.js",
        loc: "1:5",
      }),
    ).toBe("./src/app.js (babel-loader!./src/app.js) 1:5");
  });

  it("names the file as well, when webpack named a different one", () => {
    expect(
      problemLocation({ moduleName: "./src/app.js", file: "./src/other.js" }),
    ).toBe("./src/app.js (./src/other.js)");
  });

  it("does not name the same file twice", () => {
    // Webpack usually names no file at all, and when it does it is often the
    // module itself — appending it either way read as `./app.js (./app.js)`.
    expect(
      problemLocation({ moduleName: "./src/app.js", file: "./src/app.js" }),
    ).toBe("./src/app.js");
  });

  it("falls back to the file when there is no module", () => {
    expect(problemLocation({ file: "./src/app.js" })).toBe("./src/app.js");
  });

  it("says nothing when webpack named neither", () => {
    // Not a space, which is what it used to be: the overlay reads the first
    // line as the heading, so a blank one is a heading with nothing in it.
    expect(problemLocation({ loc: "main", message: "Boom" })).toBe("");
    expect(problemLocation({ message: "Boom" })).toBe("");
  });

  it("has nowhere to place a message on its own", () => {
    expect(problemLocation("just a message")).toBe("");
  });
});

describe("what a problem says", () => {
  it("is the message", () => {
    expect(problemBody({ message: "Boom" })).toBe("Boom");
  });

  it("is the string itself, when that is all there is", () => {
    expect(problemBody("Boom")).toBe("Boom");
  });

  it("carries the stack webpack attached", () => {
    expect(problemBody({ message: "Boom", stack: ["  at a", "  at b"] })).toBe(
      "Boom\r\n  at a\r\n  at b",
    );
  });

  it("ignores frames that are not strings", () => {
    expect(
      problemBody({ message: "Boom", stack: [{ nope: true }, "  at b"] }),
    ).toBe("Boom\r\n  at b");
  });

  it("has nothing to say for a problem with no message", () => {
    expect(problemBody({ moduleName: "./src/app.js" })).toBe("");
  });
});

describe("a problem as the overlay renders it", () => {
  it("is the location, then what it says", () => {
    expect(
      problemLine({ moduleName: "./src/app.js", loc: "3:0", message: "Boom" }),
    ).toBe("./src/app.js 3:0\nBoom");
  });

  it("is the message alone when there is no location", () => {
    // The first line is the heading, so an empty one would render a heading
    // with nothing in it and push the message down a line.
    expect(problemLine({ message: "Boom" })).toBe("Boom");
  });

  it("leaves a message that is already a string alone", () => {
    expect(problemLine("Boom")).toBe("Boom");
  });
});

describe("a problem split for a console", () => {
  it("puts the level and the location in the header", () => {
    expect(
      formatProblem("error", {
        moduleName: "./src/app.js",
        loc: "3:0",
        message: "Boom",
      }),
    ).toStrictEqual({ header: "ERROR in ./src/app.js 3:0", body: "Boom" });
  });

  it("says WARNING for a warning and ERROR for everything else", () => {
    expect(formatProblem("warning", { message: "Careful" }).header).toBe(
      "WARNING",
    );
    expect(formatProblem("error", { message: "Boom" }).header).toBe("ERROR");
  });

  it("leaves the level alone when there is no location to add", () => {
    expect(formatProblem("error", "Boom")).toStrictEqual({
      header: "ERROR",
      body: "Boom",
    });
  });
});
