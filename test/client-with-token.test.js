import withToken from "../client-src/utils/with-token";

describe("putting the token on the endpoint", () => {
  it("leaves the path alone when there is no token", () => {
    expect(withToken("/__webpack_hmr", undefined)).toBe("/__webpack_hmr");
    expect(withToken("/__webpack_hmr", "")).toBe("/__webpack_hmr");
  });

  it("adds a query to a path that has none", () => {
    expect(withToken("/__webpack_hmr", "abc")).toBe("/__webpack_hmr?token=abc");
  });

  it("joins a query the path already carries", () => {
    expect(withToken("/__webpack_hmr?name=main", "abc")).toBe(
      "/__webpack_hmr?name=main&token=abc",
    );
  });

  // The one that made this a function rather than a concatenation: appending
  // would leave two `token` parameters, and the endpoint reads the first — so
  // the token configured here would be the one ignored.
  it("replaces a token the path already carries", () => {
    expect(withToken("/__webpack_hmr?token=stale", "fresh")).toBe(
      "/__webpack_hmr?token=fresh",
    );
    expect(withToken("/__webpack_hmr?token=a&token=b", "fresh")).toBe(
      "/__webpack_hmr?token=fresh",
    );
  });

  it("keeps the query ahead of a fragment, rather than inside it", () => {
    expect(withToken("/__webpack_hmr#frag", "abc")).toBe(
      "/__webpack_hmr?token=abc#frag",
    );
    expect(withToken("/__webpack_hmr?name=main#frag", "abc")).toBe(
      "/__webpack_hmr?name=main&token=abc#frag",
    );
  });

  it("keeps an absolute url absolute", () => {
    expect(withToken("ws://127.0.0.1:8080/__webpack_hmr", "abc")).toBe(
      "ws://127.0.0.1:8080/__webpack_hmr?token=abc",
    );
    expect(withToken("//127.0.0.1:8080/__webpack_hmr", "abc")).toBe(
      "//127.0.0.1:8080/__webpack_hmr?token=abc",
    );
  });

  it("keeps a relative path relative", () => {
    // `URL` would have needed a base and returned an absolute url for this.
    expect(withToken("__webpack_hmr", "abc")).toBe("__webpack_hmr?token=abc");
  });

  it("escapes a token that needs it", () => {
    expect(withToken("/__webpack_hmr", "a b&c=d")).toBe(
      "/__webpack_hmr?token=a+b%26c%3Dd",
    );
  });
});
