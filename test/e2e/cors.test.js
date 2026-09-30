import { closeE2e } from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

// Whether a page on another origin can read the event stream is the browser's
// decision, made from the grant the endpoint sends — so it is the browser that
// has to be asked. Until this option existed the endpoint answered every
// request with `Access-Control-Allow-Origin: *`, inherited from
// `webpack-hot-middleware`, and a payload carries a build's module paths and
// the source frames webpack puts in a parse error.
//
// `127.0.0.1` and `localhost` are the same server on the same port and two
// different origins, which is all this needs: the page is loaded from one and
// opens a stream on the other.
describe("reading the event stream from another origin (browser)", () => {
  let hotApp;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
  });

  /**
   * Open a stream on the other origin from inside the page and report how the
   * browser answered.
   * @param {string} streamUrl the endpoint, on the origin the page is not on
   * @returns {Promise<"open" | "error">} which event arrived first
   */
  const readFromOtherOrigin = (streamUrl) =>
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

  it("is refused by default", async () => {
    hotApp = await createHotApp({ code: "console.log('app')" });
    ({ page, browser } = await runBrowser());

    const { port } = new URL(hotApp.url);

    await page.goto(`http://localhost:${port}/`);

    await expect(
      readFromOtherOrigin(`http://127.0.0.1:${port}/__webpack_hmr`),
    ).resolves.toBe("error");
  });

  it("is allowed once every origin is granted", async () => {
    hotApp = await createHotApp({
      code: "console.log('app')",
      hot: { allowedOrigins: true },
    });
    ({ page, browser } = await runBrowser());

    const { port } = new URL(hotApp.url);

    await page.goto(`http://localhost:${port}/`);

    await expect(
      readFromOtherOrigin(`http://127.0.0.1:${port}/__webpack_hmr`),
    ).resolves.toBe("open");
  });

  it("leaves the page's own origin alone", async () => {
    // The default must not be read as a refusal: a browser sends no `Origin`
    // at all for a same-origin `EventSource`, which is how every client
    // connects unless it was pointed somewhere else.
    hotApp = await createHotApp({ code: "console.log('app')" });
    ({ page, browser } = await runBrowser());

    await page.goto(hotApp.url);

    await expect(
      readFromOtherOrigin(`${hotApp.url}__webpack_hmr`),
    ).resolves.toBe("open");
  });
});
