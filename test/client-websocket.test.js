import WebSocketClient from "../client-src/clients/WebSocketClient";

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_OBJECT */

describe("WebSocketClient", () => {
  /** @type {string[]} */
  let urls;

  beforeEach(() => {
    urls = [];

    // The page this runtime would be running in.
    globalThis.document = /** @type {EXPECTED_OBJECT} */ ({
      createElement: () => {
        const anchor = { href: "" };

        Object.defineProperty(anchor, "href", {
          get: () => anchor._resolved,
          set: (value) => {
            // What a browser does with `a.href`: resolve against the page.
            anchor._resolved = /^[a-z]+:\/\//i.test(value)
              ? value
              : `https://example.test${value.startsWith("/") ? "" : "/"}${value}`;
          },
        });

        return anchor;
      },
    });

    globalThis.WebSocket = /** @type {EXPECTED_OBJECT} */ (
      function WebSocket(url) {
        urls.push(url);
      }
    );
  });

  afterEach(() => {
    delete globalThis.document;
    delete globalThis.WebSocket;
  });

  it("resolves a path into an absolute wss: url", () => {
    // `WebSocket` only learned to take a relative url in 2024, and the default
    // endpoint is a path — so on any older browser this would throw outright.
    const client = new WebSocketClient("/__webpack_hmr");

    expect(urls).toEqual(["wss://example.test/__webpack_hmr"]);
    expect(client).toBeDefined();
  });

  it("maps an http: endpoint onto ws:", () => {
    const client = new WebSocketClient("http://localhost:8080/__webpack_hmr");

    expect(urls).toEqual(["ws://localhost:8080/__webpack_hmr"]);
    expect(client).toBeDefined();
  });

  it("leaves an endpoint which is already a WebSocket url alone", () => {
    const client = new WebSocketClient("wss://other.test/hmr");

    expect(urls).toEqual(["wss://other.test/hmr"]);
    expect(client).toBeDefined();
  });
});
