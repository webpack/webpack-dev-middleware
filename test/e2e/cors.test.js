import { CORS_LOCAL_ORIGINS } from "../../src/utils";
import { closeE2e } from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

// Whether a page on another origin can read the event stream is the browser's
// decision, made from the grant the endpoint sends — so it is the browser that
// has to be asked. Until the `cors` option existed the endpoint answered every
// request with `Access-Control-Allow-Origin: *`, inherited from
// `webpack-hot-middleware`, and a payload carries a build's module paths and
// the source frames webpack puts in a parse error.
//
// One server on one port is several origins, which is all this needs. The
// default grant allows the local ones, so:
//
//   * `localhost` is a different origin from `127.0.0.1` and an allowed one,
//   * `127.0.0.2` is a different origin that the default does not allow, and
//     stands in for a site the developer merely has open.
describe("reading the event stream from another origin (browser)", () => {
  let hotApp;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
  });

  /**
   * Open a stream on another origin from inside the page and report how the
   * browser answered.
   * @param {string} streamUrl the endpoint, on an origin the page is not on
   * @returns {Promise<"open" | "error">} which event arrived first
   */
  const readFromPage = (streamUrl) =>
    page.evaluate(
      (url) =>
        new Promise((resolve) => {
          const source = new EventSource(url);
          const settle = (result) => {
            source.close();
            resolve(result);
          };

          source.addEventListener("open", () => settle("open"));
          // A blocked stream fails the connection rather than saying why: the
          // response arrived, and the browser refused to hand it over.
          source.addEventListener("error", () => settle("error"));
        }),
      streamUrl,
    );

  /**
   * Serve the app, then open its page on `host` and the stream on `127.0.0.1`.
   * @param {EXPECTED_ANY} hot the middleware's `hot` option
   * @param {string} host the host to load the page from
   * @returns {Promise<"open" | "error">} what the browser made of the stream
   */
  const readAcrossOrigins = async (hot, host) => {
    hotApp = await createHotApp({ code: "console.log('app')", hot });
    ({ page, browser } = await runBrowser());

    const { port } = new URL(hotApp.url);

    await page.goto(`http://${host}:${port}/`);

    return readFromPage(`http://127.0.0.1:${port}/__webpack_hmr`);
  };

  // The event stream has always granted every origin, and narrowing that
  // would stop a page served from another origin reading its own build — so
  // the default stays as it shipped.
  // TODO in the next major release this becomes the local origins, and this
  // test becomes the `cors: CORS_LOCAL_ORIGINS` one below.
  it("allows any origin by default, as it did before the option", async () => {
    await expect(readAcrossOrigins(true, "127.0.0.2")).resolves.toBe("open");
  });

  it("refuses an origin the local ones do not cover", async () => {
    await expect(
      readAcrossOrigins({ cors: CORS_LOCAL_ORIGINS }, "127.0.0.2"),
    ).resolves.toBe("error");
  });

  it("allows another origin on the same machine when narrowed to them", async () => {
    await expect(
      readAcrossOrigins({ cors: CORS_LOCAL_ORIGINS }, "localhost"),
    ).resolves.toBe("open");
  });

  it("refuses even a local origin once cors is off", async () => {
    await expect(readAcrossOrigins({ cors: false }, "localhost")).resolves.toBe(
      "error",
    );
  });

  it("allows any origin once every one of them is granted", async () => {
    await expect(readAcrossOrigins({ cors: true }, "127.0.0.2")).resolves.toBe(
      "open",
    );
  });

  // The same option over the other transport, where it can only be honoured by
  // refusing the upgrade: a handshake is not subject to CORS, so the browser
  // sends `Origin` and pays no attention to what comes back. Which means the
  // page here is told nothing beyond "it failed" — the refusal is the `403` on
  // the wire, and what the browser does with it is what these check.
  describe("over a WebSocket", () => {
    /**
     * Open a socket on another origin from inside the page.
     * @param {string} socketUrl the endpoint, on an origin the page is not on
     * @returns {Promise<"open" | "error">} which event arrived first
     */
    const connectFromPage = (socketUrl) =>
      page.evaluate(
        (url) =>
          new Promise((resolve) => {
            const socket = new WebSocket(url);
            const settle = (result) => {
              socket.close();
              resolve(result);
            };

            socket.addEventListener("open", () => settle("open"));
            socket.addEventListener("error", () => settle("error"));
          }),
        socketUrl,
      );

    /**
     * Serve the app over the `ws` transport, then open its page on `host` and
     * a socket on `127.0.0.1`.
     * @param {EXPECTED_ANY} hot the middleware's `hot` option
     * @param {string} host the host to load the page from
     * @returns {Promise<"open" | "error">} what the browser made of the socket
     */
    const connectAcrossOrigins = async (hot, host) => {
      hotApp = await createHotApp({
        code: "console.log('app')",
        transport: "ws",
        hot,
      });
      ({ page, browser } = await runBrowser());

      const { port } = new URL(hotApp.url);

      await page.goto(`http://${host}:${port}/`);

      // The fixture asks for a token, and this socket is built here rather
      // than taken from the injected client — so it carries the one the
      // middleware resolved. Without it the endpoint refuses before it ever
      // looks at the origin, which is what this test is about.
      const token = encodeURIComponent(hotApp.instance.token);

      return connectFromPage(
        `ws://127.0.0.1:${port}/__webpack_hmr?token=${token}`,
      );
    };

    it("refuses an origin the default does not allow", async () => {
      await expect(connectAcrossOrigins(true, "127.0.0.2")).resolves.toBe(
        "error",
      );
    });

    it("allows another origin on the same machine by default", async () => {
      await expect(connectAcrossOrigins(true, "localhost")).resolves.toBe(
        "open",
      );
    });

    it("refuses even a local origin once cors is off", async () => {
      await expect(
        connectAcrossOrigins({ cors: false }, "localhost"),
      ).resolves.toBe("error");
    });

    it("allows any origin once every one of them is granted", async () => {
      await expect(
        connectAcrossOrigins({ cors: true }, "127.0.0.2"),
      ).resolves.toBe("open");
    });
  });

  it("leaves the page's own origin alone", async () => {
    // The default must not be read as a refusal: a browser sends no `Origin`
    // at all for a same-origin `EventSource`, which is how every client
    // connects unless it was pointed somewhere else.
    hotApp = await createHotApp({ code: "console.log('app')" });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);

    await expect(readFromPage(`${hotApp.url}__webpack_hmr`)).resolves.toBe(
      "open",
    );
  });
});
