import collectConsole from "../helpers/console-collector";
import { closeE2e, waitForOverlay, waitForOverlayText } from "../helpers/e2e";
import createHotApp from "../helpers/hot-app";
import runBrowser from "../helpers/run-browser";

jest.setTimeout(400000);

// Build output reaches the overlay as HTML. The text in it is not ours: a
// module's own source turns up in a parse error's code frame, loaders and
// plugins write their own messages, and file paths come from the filesystem.
// So each of these is a payload a developer could be made to compile.
const PAYLOADS = [
  '<img src=x onerror="window.__xss=1">',
  '"><script>window.__xss=1</script>',
  '<svg onload="window.__xss=1">',
  '<iframe srcdoc="&lt;script&gt;parent.__xss=1&lt;/script&gt;">',
  '<a href="javascript:window.__xss=1">click</a>',
  // Through the ANSI path, which inserts markup of its own around the text.
  '\u001B[31m<img src=x onerror="window.__xss=1">\u001B[39m',
  // Through linkify, which builds an `<a href>` out of matched text.
  'http://a"onmouseover="window.__xss=1',
  "http://a'onmouseover='window.__xss=1",
  // Through the file-reference highlighter, which wraps a `<span>`.
  './x<img src=x onerror="window.__xss=1">.js 1:1',
  // Attribute break-out against the styles those helpers write.
  '</span><img src=x onerror="window.__xss=1">',
  "';window.__xss=1;'",
];

describe("the overlay does not execute what it renders (browser)", () => {
  let hotApp;
  let browser;
  let page;

  afterEach(async () => {
    ({ browser, app: hotApp } = await closeE2e(browser, hotApp));
  });

  it.each(PAYLOADS)("renders %j as text", async (payload) => {
    // A module whose source does not parse: webpack reports the offending
    // line, payload and all, and the overlay renders the report.
    hotApp = await createHotApp({ code: `(((${payload}` });
    ({ page, browser } = await runBrowser());

    const console_ = collectConsole(page);

    await page.goto(hotApp.url);
    await console_.waitFor("connected");
    await waitForOverlayText(page, { includes: ["Module parse failed"] });

    const frame = await waitForOverlay(page);

    // Nothing ran, in the page or in the overlay's own document.
    expect(await page.evaluate(() => globalThis.__xss ?? null)).toBeNull();

    const injected = await frame.evaluate(() => ({
      xss: globalThis.__xss ?? null,
      scripts: document.querySelectorAll("script").length,
      iframes: document.querySelectorAll("iframe").length,
      handlers: [...document.querySelectorAll("*")].filter((node) =>
        [...node.attributes].some((attribute) =>
          attribute.name.startsWith("on"),
        ),
      ).length,
      brokenImages: [...document.querySelectorAll("[src]")]
        .map((node) => node.getAttribute("src"))
        .filter((src) => src === "x").length,
      scriptSchemeLinks: [...document.querySelectorAll("a[href]")]
        .map((node) => node.getAttribute("href"))
        .filter((href) => /^javascript:/i.test(href)).length,
    }));

    expect(injected).toStrictEqual({
      xss: null,
      scripts: 0,
      iframes: 0,
      handlers: 0,
      brokenImages: 0,
      scriptSchemeLinks: 0,
    });
  });
});
