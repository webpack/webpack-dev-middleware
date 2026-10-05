import resolveSocketUrl, { formatUrl } from "../client-src/utils/socket-url.js";

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_OBJECT */

const DEFAULT_PATHNAME = "/ws";

/**
 * Resolve a spec as a page at `location` would.
 * @param {EXPECTED_OBJECT} spec the parts that were given
 * @param {string} location where the page is
 * @param {("sse" | "ws")=} transport which transport the url is for
 * @returns {string} the url the runtime would connect to
 */
function at(spec, location, transport = "ws") {
  const previous = globalThis.self;

  globalThis.self = /** @type {EXPECTED_OBJECT} */ ({
    location: new URL(location),
  });

  try {
    return resolveSocketUrl(spec, DEFAULT_PATHNAME, transport);
  } finally {
    globalThis.self = previous;
  }
}

// Ported case for case from webpack-dev-server's `createSocketURL` tests, the
// behaviour this replaces. Each row is the spec, where the page is, and the
// url a runtime there has to end up connecting to — the same expectations
// that project has held since these were query parameters.
describe("resolving where the runtime connects", () => {
  const cases = [
    [
      { hostname: "example.com", pathname: "/ws" },
      "http://example.com",
      "ws://example.com/ws",
    ],
    [{ protocol: "auto:" }, "http://example.com", "ws://example.com/ws"],
    [{ protocol: "auto:" }, "https://example.com", "wss://example.com/ws"],
    // `auto` without the colon, which is how the option is spelled.
    [{ protocol: "auto" }, "https://example.com", "wss://example.com/ws"],
    [{ protocol: "wss:" }, "http://example.com", "wss://example.com/ws"],
    [{ protocol: "https:" }, "https://example.com", "wss://example.com/ws"],
    [{ protocol: "http:" }, "https://example.com", "ws://example.com/ws"],
    [{ hostname: "example.com" }, "http://example.com", "ws://example.com/ws"],
    [
      { hostname: "example.com", username: "first last", password: "a=b+c" },
      "http://example.com",
      "ws://first%20last:a%3Db%2Bc@example.com/ws",
    ],
    [
      { hostname: "example.com", username: "user", password: "a=b" },
      "http://example.com",
      "ws://user:a%3Db@example.com/ws",
    ],
    [
      { username: "username", password: "password" },
      "http://example.com",
      "ws://username:password@example.com/ws",
    ],
    [
      { hostname: "example.com", port: 80 },
      "http://example.com",
      "ws://example.com:80/ws",
    ],
    // `0` is a port the server picked, so the page's own is the one that works.
    [{ port: 0 }, "http://example.com:8080", "ws://example.com:8080/ws"],
    [{ port: "0" }, "http://example.com:8080", "ws://example.com:8080/ws"],
    [{ port: 80 }, "http://example.com:8080", "ws://example.com:80/ws"],
    // Every interface is not an address a page can reach, so the page's host
    // stands in — it is one that demonstrably works, since the page came from
    // this server over it.
    [{ hostname: "0.0.0.0" }, "http://127.0.0.1", "ws://127.0.0.1/ws"],
    [{ hostname: "0.0.0.0" }, "http://192.168.0.1", "ws://192.168.0.1/ws"],
    [{ hostname: "0.0.0.0" }, "https://192.168.0.1", "wss://192.168.0.1/ws"],
    [{ hostname: "0.0.0.0" }, "https://example.com", "wss://example.com/ws"],
    [
      { hostname: "0.0.0.0" },
      "http://example.com:8080",
      "ws://example.com:8080/ws",
    ],
    [
      { hostname: "0.0.0.0" },
      "https://example.com:8080",
      "wss://example.com:8080/ws",
    ],
    [{ hostname: "::" }, "http://example.com:8080", "ws://example.com:8080/ws"],
    [
      { hostname: "[::]" },
      "http://example.com:8080",
      "ws://example.com:8080/ws",
    ],
    [
      { hostname: "::" },
      "https://example.com:8080",
      "wss://example.com:8080/ws",
    ],
    // A single address rather than every interface, so it is kept — and
    // bracketed, which a url needs and the address itself does not carry.
    [{ hostname: "::1" }, "http://example.com:8080", "ws://[::1]:8080/ws"],
    [{ hostname: "::1" }, "https://example.com:8080", "wss://[::1]:8080/ws"],
    [
      { pathname: "/custom-ws" },
      "http://example.com",
      "ws://example.com/custom-ws",
    ],
    [
      {
        protocol: "wss:",
        username: "user",
        password: "password",
        hostname: "localhost",
        port: 8080,
        pathname: "/ws",
      },
      "http://user:password@localhost/",
      "wss://user:password@localhost:8080/ws",
    ],
  ];

  for (const [spec, location, expected] of cases) {
    it(`${JSON.stringify(spec)} at ${location} connects to ${expected}`, () => {
      expect(at(spec, location)).toBe(expected);
    });
  }

  it("falls back to the endpoint's own path when the spec names none", () => {
    expect(at({ hostname: "example.com" }, "http://example.com")).toBe(
      "ws://example.com/ws",
    );
    expect(
      resolveSocketUrl({ hostname: "example.com" }, "/__webpack_hmr", "ws"),
    ).toContain("/__webpack_hmr");
  });

  // The separator between a username and a password is not part of either, so
  // they are encoded one at a time. Encoding the pair and restoring one colon
  // finds the username's own colon first when it has one, and the credentials
  // then split in the wrong place — `a:b` / `pw` arriving as `a` / `b:pw`.
  it("keeps a colon inside a username out of the separator", () => {
    expect(
      at(
        { hostname: "h.test", username: "a:b", password: "pw" },
        "http://p.test",
      ),
    ).toBe("ws://a%3Ab:pw@h.test/ws");
  });

  it("encodes a colon inside a password too", () => {
    expect(
      at(
        { hostname: "h.test", username: "u", password: "p:q" },
        "http://p.test",
      ),
    ).toBe("ws://u:p%3Aq@h.test/ws");
  });

  // A scheme is written both with and without its colon, and the option takes
  // either — `formatUrl` puts a missing one back. Requiring it when deciding
  // whether TLS is in play read `"https"` as insecure, which pointed a secure
  // page at an endpoint its browser will not open.
  describe("a scheme said with or without its colon", () => {
    const cases = [
      [{ hostname: "h.test", protocol: "https" }, "ws", "wss://h.test/ws"],
      [{ hostname: "h.test", protocol: "https:" }, "ws", "wss://h.test/ws"],
      [{ hostname: "h.test", protocol: "wss" }, "sse", "https://h.test/ws"],
      [{ hostname: "h.test", protocol: "wss:" }, "sse", "https://h.test/ws"],
      // Case is not part of a scheme either.
      [{ hostname: "h.test", protocol: "HTTPS" }, "ws", "wss://h.test/ws"],
      [{ hostname: "h.test", protocol: "http" }, "ws", "ws://h.test/ws"],
      // `auto` reads the page, whichever way it is written.
      [{ hostname: "h.test", protocol: "auto" }, "ws", "wss://h.test/ws"],
      [{ hostname: "h.test", protocol: "auto:" }, "ws", "wss://h.test/ws"],
    ];

    for (const [spec, transport, expected] of cases) {
      it(`${spec.protocol} over ${transport} connects to ${expected}`, () => {
        expect(at(spec, "https://page.test", transport)).toBe(expected);
      });
    }
  });

  // A password with no username is not something basic authentication can
  // carry, and sending `:secret@` would put the password in the url with
  // nothing to authenticate as.
  it("drops a password that has no username with it", () => {
    expect(at({ password: "secret" }, "http://example.com")).toBe(
      "ws://example.com/ws",
    );
  });

  it("works where there is no location at all", () => {
    const previous = globalThis.self;

    // A worker built without one, and whatever else runs this without a page.
    globalThis.self = /** @type {EXPECTED_OBJECT} */ (undefined);

    try {
      expect(
        resolveSocketUrl(
          { hostname: "example.com", port: 8080 },
          DEFAULT_PATHNAME,
          "ws",
        ),
      ).toBe("ws://example.com:8080/ws");
    } finally {
      globalThis.self = previous;
    }
  });
});

describe("assembling a url from its parts", () => {
  it("adds the colon a protocol was given without", () => {
    expect(formatUrl({ protocol: "ws", hostname: "a.test" })).toBe(
      "ws://a.test",
    );
  });

  it("gives a path the leading slash it was given without", () => {
    expect(
      formatUrl({ protocol: "ws:", hostname: "a.test", pathname: "ws" }),
    ).toBe("ws://a.test/ws");
  });

  // `?` and `#` end a path as far as a browser is concerned, so a path that
  // contains one has to say it meant the character.
  it("encodes a query or fragment character inside the path", () => {
    expect(
      formatUrl({ protocol: "ws:", hostname: "a.test", pathname: "/a?b#c" }),
    ).toBe("ws://a.test/a%3Fb%23c");
  });

  it("brackets a raw IPv6 host and nothing else", () => {
    expect(formatUrl({ protocol: "ws:", hostname: "::1", port: "8080" })).toBe(
      "ws://[::1]:8080",
    );
    expect(
      formatUrl({ protocol: "ws:", hostname: "127.0.0.1", port: "8080" }),
    ).toBe("ws://127.0.0.1:8080");
  });
});

// The default transport, which does not speak the WebSocket schemes at all: an
// `EventSource` pointed at `ws://` never connects. Whatever a page was served
// over says only whether TLS is in play; which scheme that makes it is the
// transport's.
describe("the scheme each transport connects over", () => {
  const cases = [
    [
      { hostname: "example.com" },
      "http://example.com",
      "sse",
      "http://example.com/ws",
    ],
    [
      { hostname: "example.com" },
      "https://example.com",
      "sse",
      "https://example.com/ws",
    ],
    [
      { protocol: "auto" },
      "https://example.com",
      "sse",
      "https://example.com/ws",
    ],
    // Said as a WebSocket scheme but used by Server-Sent Events: the secure
    // half of it is what carries over, not the scheme itself.
    [
      { protocol: "wss:" },
      "http://example.com",
      "sse",
      "https://example.com/ws",
    ],
    [
      { protocol: "https:" },
      "http://example.com",
      "ws",
      "wss://example.com/ws",
    ],
    // Every interface on a secure page, over both transports.
    [
      { hostname: "0.0.0.0" },
      "https://example.com",
      "sse",
      "https://example.com/ws",
    ],
    [
      { hostname: "0.0.0.0" },
      "https://example.com",
      "ws",
      "wss://example.com/ws",
    ],
    // Neither scheme is secure, so both stay on the plain one.
    [
      { hostname: "example.com" },
      "file:///app/index.html",
      "sse",
      "http://example.com/ws",
    ],
    [
      { hostname: "example.com" },
      "chrome-extension://abc/",
      "ws",
      "ws://example.com/ws",
    ],
  ];

  for (const [spec, location, transport, expected] of cases) {
    it(`${JSON.stringify(spec)} at ${location} over ${transport} connects to ${expected}`, () => {
      expect(at(spec, location, transport)).toBe(expected);
    });
  }

  // Called with no transport at all, which is how it reads a client whose
  // query did not name one.
  it("treats anything but `ws` as the default transport", () => {
    const previous = globalThis.self;

    globalThis.self = /** @type {EXPECTED_OBJECT} */ ({
      location: new URL("http://a.test"),
    });

    try {
      expect(resolveSocketUrl({ hostname: "a.test" }, DEFAULT_PATHNAME)).toBe(
        "http://a.test/ws",
      );
    } finally {
      globalThis.self = previous;
    }
  });
});
