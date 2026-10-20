import openEditorUrl from "../client-src/utils/open-editor-url";

describe("the overlay's open-editor url", () => {
  it("asks for the reference", () => {
    expect(openEditorUrl("/__open-editor", "./app.js:1:7")).toBe(
      "/__open-editor?fileName=.%2Fapp.js%3A1%3A7",
    );
  });

  it("carries the token to an endpoint on this server", () => {
    expect(openEditorUrl("/__open-editor", "./app.js:1:7", "abc")).toBe(
      "/__open-editor?fileName=.%2Fapp.js%3A1%3A7&token=abc",
    );
  });

  it("puts the reference into a query the endpoint already has", () => {
    expect(
      openEditorUrl("/__open-editor?editor=code#x", "./a b.js", "abc"),
    ).toBe("/__open-editor?editor=code&fileName=.%2Fa%20b.js&token=abc#x");
  });

  // Any server can be named by an absolute url, and the token is not theirs.
  it("keeps it from an endpoint that could be another server", () => {
    for (const endpoint of [
      "https://elsewhere.example/open",
      "//elsewhere.example/open",
      "/\\elsewhere.example/open",
      "open-editor",
    ]) {
      expect(openEditorUrl(endpoint, "./app.js:1:7", "abc")).not.toContain(
        "token",
      );
    }
  });

  it("adds nothing when there is no token", () => {
    expect(openEditorUrl("/__open-editor", "./app.js:1:7", "")).not.toContain(
      "token",
    );
  });
});
