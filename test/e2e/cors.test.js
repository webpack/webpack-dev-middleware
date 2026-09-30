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

  it("refuses an origin the default does not allow", async () => {
    await expect(readAcrossOrigins(true, "127.0.0.2")).resolves.toBe("error");
  });

  it("allows another origin on the same machine by default", async () => {
    await expect(readAcrossOrigins(true, "localhost")).resolves.toBe("open");
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
