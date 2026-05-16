/**
 * @jest-environment jsdom
 */

// `process-update.js` throws at require-time when `module.hot` is missing
// (which is always true outside a webpack runtime). Replace it with a no-op so
// the client itself can be exercised in jsdom.
jest.mock("../client-src/process-update", () => jest.fn(), { virtual: false });

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/**
 * @returns {{
 * EventSourceMock: EXPECTED_ANY,
 * instances: EXPECTED_ANY[],
 * reset: () => void,
 * }} mock EventSource constructor
 */
function setupEventSource() {
  const instances = [];

  class EventSourceMock {
    constructor(url) {
      this.url = url;
      this.listeners = { open: [], error: [], message: [] };
      this.closed = false;
      instances.push(this);
    }

    addEventListener(type, fn) {
      if (this.listeners[type]) this.listeners[type].push(fn);
    }

    dispatch(type, event) {
      for (const fn of this.listeners[type] || []) {
        fn(event);
      }
    }

    close() {
      this.closed = true;
    }
  }

  return {
    EventSourceMock,
    instances,
    reset() {
      instances.length = 0;
    },
  };
}

describe("client runtime", () => {
  let mock;

  beforeEach(() => {
    jest.resetModules();
    mock = setupEventSource();
    globalThis.EventSource = mock.EventSourceMock;
    // Each test simulates the client being loaded for the first time on the
    // page, so any per-page singletons need to be cleared from `window`.
    delete globalThis.__wdmEventSourceWrapper;
    delete globalThis.__webpack_dev_middleware_hot_reporter__;
  });

  afterEach(() => {
    delete globalThis.EventSource;
    delete globalThis.__wdmEventSourceWrapper;
    delete globalThis.__webpack_dev_middleware_hot_reporter__;
  });

  it("opens an EventSource on the default path when autoConnect is on", () => {
    require("../client-src");

    expect(mock.instances).toHaveLength(1);
    expect(mock.instances[0].url).toBe("/__webpack_hmr");
  });

  it("does not open an EventSource when window is not present yet", () => {
    // Simulate a non-browser environment by removing EventSource.
    delete globalThis.EventSource;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    require("../client-src");

    expect(warn).toHaveBeenCalled();
    expect(mock.instances).toHaveLength(0);

    warn.mockRestore();
  });

  it("ignores heartbeat messages", () => {
    const client = require("../client-src");

    const handler = jest.fn();
    client.subscribeAll(handler);

    mock.instances[0].dispatch("message", { data: "💓" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("dispatches building messages to subscribers", () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});

    const client = require("../client-src");

    const seen = [];
    client.subscribeAll((obj) => seen.push(obj));

    mock.instances[0].dispatch("message", {
      data: JSON.stringify({ action: "building" }),
    });

    expect(seen).toEqual([{ action: "building" }]);
    expect(log.mock.calls.some(([msg]) => /rebuilding/.test(msg))).toBe(true);

    log.mockRestore();
  });

  it("invokes the custom handler for unknown actions", () => {
    const client = require("../client-src");

    const customs = [];
    client.subscribe((obj) => customs.push(obj));

    mock.instances[0].dispatch("message", {
      data: JSON.stringify({ action: "custom-thing", payload: 1 }),
    });

    expect(customs).toEqual([{ action: "custom-thing", payload: 1 }]);
  });

  it("warns on invalid JSON", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    require("../client-src");

    mock.instances[0].dispatch("message", { data: "not-json{" });

    expect(
      warn.mock.calls.some(([msg]) => /Invalid HMR message/.test(msg)),
    ).toBe(true);

    warn.mockRestore();
  });

  it("reuses the same EventSource for multiple entries on the same path", () => {
    require("../client-src");
    // Re-load the module — the wrapper should be reused via `window.__wdmEventSourceWrapper`.
    jest.resetModules();
    require("../client-src");

    expect(mock.instances).toHaveLength(1);
  });

  it("closes and re-opens the connection on timeout", () => {
    jest.useFakeTimers({ doNotFake: ["nextTick"] });
    try {
      require("../client-src");

      const [first] = mock.instances;
      expect(first.closed).toBe(false);

      // Advance past 2x the timeout window so the heartbeat watchdog ticks at
      // least once with `Date.now() - lastActivity > timeout`.
      jest.advanceTimersByTime(30 * 1000);

      expect(first.closed).toBe(true);

      // Reconnect timer scheduled with options.timeout (20s).
      jest.advanceTimersByTime(20 * 1000);

      expect(mock.instances).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
