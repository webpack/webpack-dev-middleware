// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_OBJECT */

/**
 * Stand in for the page. The module registers its listeners when it is first
 * imported, so this has to be in place before the import — hence the
 * `isolateModules` dance in each case below.
 * @param {string=} protocol what `location.protocol` reports
 * @returns {EXPECTED_OBJECT} the fake window and what it recorded
 */
function fakeWindow(protocol = "http:") {
  /** @type {Record<string, (() => void)[]>} */
  const listeners = {};
  const reload = jest.fn();

  /** @type {EXPECTED_OBJECT} */
  const win = {
    addEventListener(type, fn) {
      listeners[type] ||= [];
      listeners[type].push(fn);
    },
    location: { protocol, reload },
  };

  win.parent = win;
  globalThis.window = win;

  return {
    reload,
    /** @param {string} type event type */
    emit(type) {
      for (const fn of listeners[type] || []) {
        fn();
      }
    },
  };
}

/**
 * @returns {EXPECTED_OBJECT} a freshly imported copy of the module
 */
function loadModule() {
  /** @type {EXPECTED_OBJECT} */
  let loaded;

  jest.isolateModules(() => {
    loaded = require("../client-src/utils/reload.js");
  });

  return loaded;
}

describe("reloadPage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete globalThis.window;
  });

  it("reloads straight away when nothing is going on", () => {
    const page = fakeWindow();
    const { default: reloadPage } = loadModule();

    reloadPage();

    expect(page.reload).toHaveBeenCalledTimes(1);
  });

  it("holds a reload while the page looks like it is leaving", () => {
    const page = fakeWindow();
    const { default: reloadPage, isUnloading } = loadModule();

    page.emit("beforeunload");

    expect(isUnloading()).toBe(true);

    reloadPage();

    // Reloading a page the browser is already leaving is pointless at best.
    expect(page.reload).not.toHaveBeenCalled();
  });

  it("performs the held reload when the navigation was cancelled", () => {
    const page = fakeWindow();
    const { default: reloadPage } = loadModule();

    page.emit("beforeunload");
    reloadPage();

    // The page is still here, so it was a cancelled navigation — the update it
    // asked for is still wanted, and nothing else would ask again until the
    // next rebuild.
    jest.advanceTimersByTime(1000);

    expect(page.reload).toHaveBeenCalledTimes(1);
  });

  it("drops a held reload once the page really goes", () => {
    const page = fakeWindow();
    const { default: reloadPage } = loadModule();

    page.emit("beforeunload");
    reloadPage();
    page.emit("pagehide");
    jest.advanceTimersByTime(10000);

    expect(page.reload).not.toHaveBeenCalled();
  });

  it("drops a held reload when the page comes back from the cache", () => {
    const page = fakeWindow();
    const { default: reloadPage, isUnloading } = loadModule();

    page.emit("beforeunload");
    reloadPage();
    // Restored from the back/forward cache: it is showing its own state again,
    // so a reload held from before the navigation is stale.
    page.emit("pageshow");
    jest.advanceTimersByTime(10000);

    expect(isUnloading()).toBe(false);
    expect(page.reload).not.toHaveBeenCalled();
  });

  it("stops blocking updates after the page comes back", () => {
    const page = fakeWindow();
    const { default: reloadPage } = loadModule();

    page.emit("beforeunload");
    page.emit("pagehide");
    // Without `pageshow` clearing it, the flag left set by navigating away
    // would block every later update for the life of the script.
    page.emit("pageshow");

    reloadPage();

    expect(page.reload).toHaveBeenCalledTimes(1);
  });

  it("reloads an ancestor when this frame has no url of its own", () => {
    const page = fakeWindow("about:");
    const { default: reloadPage } = loadModule();
    const top = { location: { protocol: "https:", reload: jest.fn() } };

    /** @type {EXPECTED_OBJECT} */ (top).parent = top;
    globalThis.window.parent = top;

    reloadPage();

    // Reloading `about:blank` would lose the app entirely.
    expect(page.reload).not.toHaveBeenCalled();
    expect(top.location.reload).toHaveBeenCalledTimes(1);
  });

  it("settles for this frame when an ancestor cannot be read", () => {
    const page = fakeWindow("about:");
    const { default: reloadPage } = loadModule();

    Object.defineProperty(globalThis.window, "parent", {
      get() {
        throw new Error("cross-origin");
      },
    });

    reloadPage();

    expect(page.reload).toHaveBeenCalledTimes(1);
  });
});
