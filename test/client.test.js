/**
 * @jest-environment jsdom
 */

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/** @type {EXPECTED_ANY} */
let processUpdate;
/** @type {{ showProblems: jest.Mock, clear: jest.Mock }} */
let clientOverlay;

jest.mock("../client-src/process-update", () => {
  const fn = jest.fn();
  return fn;
});

jest.mock("../client-src/overlay", () => {
  const overlay = { showProblems: jest.fn(), clear: jest.fn() };
  const factory = jest.fn(() => overlay);
  factory.__getOverlay = () => overlay;
  return factory;
});

/**
 * @param {EXPECTED_ANY} obj message payload
 * @returns {{ data: string }} fake SSE event
 */
function makeMessage(obj) {
  return { data: typeof obj === "string" ? obj : JSON.stringify(obj) };
}

/**
 * Stub `EventSource` so each test can drive `message`/`error`/`open` events.
 * @returns {EXPECTED_ANY} fake constructor + last instance accessor
 */
function makeEventSourceStub() {
  /** @type {EXPECTED_ANY[]} */
  const instances = [];
  function EventSourceStub(url) {
    this.url = url;
    this.listeners = { open: [], error: [], message: [] };
    this.closed = false;
    this.addEventListener = (type, fn) => {
      if (this.listeners[type]) this.listeners[type].push(fn);
    };
    this.dispatch = (type, event) => {
      for (const fn of this.listeners[type] || []) fn(event);
    };
    this.onmessage = (event) => this.dispatch("message", event);
    // eslint-disable-next-line jest/prefer-spy-on
    this.close = jest.fn(() => {
      this.closed = true;
    });
    instances.push(this);
  }
  EventSourceStub.instances = instances;
  EventSourceStub.lastInstance = () => instances[instances.length - 1];
  return EventSourceStub;
}

/**
 * Reset module state so each test loads a fresh client. The per-page
 * singletons on `window` are NOT cleared here — the outer `afterEach` handles
 * that, so tests that re-require the client on the same "page" can observe
 * the wrapper being reused.
 * @param {string=} resourceQuery `__resourceQuery` value injected by webpack
 * @returns {EXPECTED_ANY} client module
 */
function loadClient(resourceQuery = "") {
  jest.resetModules();
  globalThis.__resourceQuery = resourceQuery;
  processUpdate = require("../client-src/process-update");
  processUpdate.mockReset();

  const overlayFactory = require("../client-src/overlay");

  clientOverlay = overlayFactory.__getOverlay();
  clientOverlay.showProblems.mockReset();
  clientOverlay.clear.mockReset();

  return require("../client-src");
}

describe("client", () => {
  afterEach(() => {
    delete globalThis.__resourceQuery;
    delete globalThis.EventSource;
    delete globalThis.__wdmEventSourceWrapper;
    delete globalThis.__webpack_dev_middleware_hot_reporter__;
    jest.useRealTimers();
  });

  describe("with default options", () => {
    let EventSourceStub;
    let client;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "warn").mockImplementation(() => {});
      jest.spyOn(console, "group").mockImplementation(() => {});
      jest.spyOn(console, "groupEnd").mockImplementation(() => {});
      client = loadClient();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("connects to /__webpack_hmr", () => {
      expect(EventSourceStub.instances).toHaveLength(1);
      expect(EventSourceStub.instances[0].url).toBe("/__webpack_hmr");
    });

    it("triggers webpack on successful builds", () => {
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: [],
          modules: [],
        }),
      );
      expect(processUpdate).toHaveBeenCalledTimes(1);
    });

    it("triggers webpack on successful syncs", () => {
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "sync",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: [],
          modules: [],
        }),
      );
      expect(processUpdate).toHaveBeenCalledTimes(1);
    });

    it("calls subscribeAll handler on default messages", () => {
      const spy = jest.fn();
      client.subscribeAll(spy);
      const message = {
        action: "built",
        time: 100,
        hash: "1234567890abcdef",
        errors: [],
        warnings: [],
        modules: [],
      };
      EventSourceStub.lastInstance().onmessage(makeMessage(message));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(message);
    });

    it("calls subscribeAll handler on custom messages", () => {
      const spy = jest.fn();
      client.subscribeAll(spy);
      EventSourceStub.lastInstance().onmessage(
        makeMessage({ action: "thingy" }),
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ action: "thingy" });
    });

    it("calls only the custom handler for custom messages", () => {
      const spy = jest.fn();
      client.subscribe(spy);
      EventSourceStub.lastInstance().onmessage(
        makeMessage({ custom: "thingy" }),
      );
      EventSourceStub.lastInstance().onmessage(
        makeMessage({ action: "built" }),
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ custom: "thingy" });
      expect(processUpdate).not.toHaveBeenCalled();
    });

    it("does not trigger webpack on errored builds", () => {
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: ["Something broke"],
          warnings: [],
          modules: [],
        }),
      );
      expect(processUpdate).not.toHaveBeenCalled();
    });

    it("shows overlay on errored builds", () => {
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: ["Something broke", "Actually, 2 things broke"],
          warnings: [],
          modules: [],
        }),
      );
      expect(clientOverlay.showProblems).toHaveBeenCalledTimes(1);
      expect(clientOverlay.showProblems).toHaveBeenCalledWith("errors", [
        "Something broke",
        "Actually, 2 things broke",
      ]);
    });

    it("hides overlay after errored build is fixed", () => {
      const es = EventSourceStub.lastInstance();
      es.onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: ["Something broke", "Actually, 2 things broke"],
          warnings: [],
          modules: [],
        }),
      );
      es.onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef2",
          errors: [],
          warnings: [],
          modules: [],
        }),
      );
      expect(clientOverlay.showProblems).toHaveBeenCalledTimes(1);
      expect(clientOverlay.clear).toHaveBeenCalledTimes(1);
    });

    it("hides overlay after errored build becomes a warning", () => {
      const es = EventSourceStub.lastInstance();
      es.onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: ["Something broke", "Actually, 2 things broke"],
          warnings: [],
          modules: [],
        }),
      );
      es.onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef2",
          errors: [],
          warnings: ["This isn't great, but it's not terrible"],
          modules: [],
        }),
      );
      expect(clientOverlay.showProblems).toHaveBeenCalledTimes(1);
      expect(clientOverlay.clear).toHaveBeenCalledTimes(1);
    });

    it("triggers webpack on warning builds", () => {
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: ["This isn't great, but it's not terrible"],
          modules: [],
        }),
      );
      expect(processUpdate).toHaveBeenCalledTimes(1);
    });

    it("does not show overlay on warning builds by default", () => {
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: ["This isn't great, but it's not terrible"],
          modules: [],
        }),
      );
      expect(clientOverlay.showProblems).not.toHaveBeenCalled();
    });

    it("shows overlay after warning build becomes an error", () => {
      const es = EventSourceStub.lastInstance();
      es.onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: ["This isn't great, but it's not terrible"],
          modules: [],
        }),
      );
      es.onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef2",
          errors: ["Something broke", "Actually, 2 things broke"],
          warnings: [],
          modules: [],
        }),
      );
      expect(clientOverlay.showProblems).toHaveBeenCalledTimes(1);
    });
  });

  describe("with overlayWarnings: true", () => {
    let EventSourceStub;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "warn").mockImplementation(() => {});
      jest.spyOn(console, "group").mockImplementation(() => {});
      jest.spyOn(console, "groupEnd").mockImplementation(() => {});
      loadClient("?overlayWarnings=true");
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("shows overlay on errored builds", () => {
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: ["Something broke", "Actually, 2 things broke"],
          warnings: [],
          modules: [],
        }),
      );
      expect(clientOverlay.showProblems).toHaveBeenCalledTimes(1);
      expect(clientOverlay.showProblems).toHaveBeenCalledWith("errors", [
        "Something broke",
        "Actually, 2 things broke",
      ]);
    });

    it("shows overlay on warning builds", () => {
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: ["This isn't great, but it's not terrible"],
          modules: [],
        }),
      );
      expect(clientOverlay.showProblems).toHaveBeenCalledTimes(1);
      expect(clientOverlay.showProblems).toHaveBeenCalledWith("warnings", [
        "This isn't great, but it's not terrible",
      ]);
    });

    it("hides overlay after warning build is fixed", () => {
      const es = EventSourceStub.lastInstance();
      es.onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: ["This isn't great, but it's not terrible"],
          modules: [],
        }),
      );
      es.onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef2",
          errors: [],
          warnings: [],
          modules: [],
        }),
      );
      expect(clientOverlay.showProblems).toHaveBeenCalledTimes(1);
      expect(clientOverlay.clear).toHaveBeenCalledTimes(1);
    });

    it("updates overlay after errored build becomes a warning", () => {
      const es = EventSourceStub.lastInstance();
      es.onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: ["Something broke"],
          warnings: [],
          modules: [],
        }),
      );
      es.onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef2",
          errors: [],
          warnings: ["This isn't great, but it's not terrible"],
          modules: [],
        }),
      );
      expect(clientOverlay.showProblems).toHaveBeenCalledTimes(2);
      expect(clientOverlay.showProblems).toHaveBeenNthCalledWith(1, "errors", [
        "Something broke",
      ]);
      expect(clientOverlay.showProblems).toHaveBeenNthCalledWith(
        2,
        "warnings",
        ["This isn't great, but it's not terrible"],
      );
    });
  });

  describe("with name option", () => {
    let EventSourceStub;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "log").mockImplementation(() => {});
      loadClient("?name=test");
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("does not trigger webpack when event name differs", () => {
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          name: "foo",
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: [],
          modules: [],
        }),
      );
      expect(processUpdate).not.toHaveBeenCalled();
    });

    it("does not trigger webpack on sync when event name differs", () => {
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          name: "bar",
          action: "sync",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: [],
          modules: [],
        }),
      );
      expect(processUpdate).not.toHaveBeenCalled();
    });
  });

  describe("connection lifecycle", () => {
    let EventSourceStub;
    let client;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "warn").mockImplementation(() => {});
      client = loadClient();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("ignores heartbeat messages", () => {
      const handler = jest.fn();
      client.subscribeAll(handler);
      EventSourceStub.lastInstance().dispatch("message", { data: "💓" });
      expect(handler).not.toHaveBeenCalled();
      expect(processUpdate).not.toHaveBeenCalled();
    });

    it("warns on invalid JSON", () => {
      EventSourceStub.lastInstance().dispatch("message", { data: "not-json{" });
      expect(
        console.warn.mock.calls.some(([msg]) =>
          /Invalid HMR message/.test(msg),
        ),
      ).toBe(true);
    });

    it("reuses the EventSource wrapper across reloads on the same path", () => {
      // Re-loading the entry on the same page should reuse the cached SSE
      // connection rather than opening a new one.
      jest.resetModules();
      require("../client-src");
      expect(EventSourceStub.instances).toHaveLength(1);
    });

    it("closes and re-opens the connection on timeout", () => {
      // The watchdog interval is created during the client's first load. Fake
      // timers must be enabled before that load so jest can drive it.
      jest.useFakeTimers({ doNotFake: ["nextTick"] });
      // Drop the wrapper opened by the outer beforeEach so we get a fresh
      // EventSource scheduled under fake timers.
      delete globalThis.__wdmEventSourceWrapper;
      EventSourceStub.instances.length = 0;
      loadClient();

      const [first] = EventSourceStub.instances;
      expect(first.closed).toBe(false);
      // The watchdog ticks at `timeout/2` and disconnects when
      // `Date.now() - lastActivity > timeout`. 30s is enough to cross that
      // boundary regardless of which tick reports it first.
      jest.advanceTimersByTime(30 * 1000);
      expect(first.closed).toBe(true);
      // Reconnect is scheduled after `options.timeout` (20s).
      jest.advanceTimersByTime(20 * 1000);
      expect(EventSourceStub.instances).toHaveLength(2);
    });
  });

  describe("with logging option", () => {
    let EventSourceStub;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "info").mockImplementation(() => {});
      jest.spyOn(console, "warn").mockImplementation(() => {});
      jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("emits info-level logs by default", () => {
      loadClient();
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: [],
          modules: [],
        }),
      );
      expect(
        console.info.mock.calls.some(([msg]) => /rebuilt/.test(String(msg))),
      ).toBe(true);
    });

    it("prefixes log output with [webpack-dev-middleware]", () => {
      loadClient();
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: [],
          modules: [],
        }),
      );
      expect(
        console.info.mock.calls.some(([msg]) =>
          /\[webpack-dev-middleware\]/.test(String(msg)),
        ),
      ).toBe(true);
    });

    it("logging=none silences every level", () => {
      loadClient("?logging=none");
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: ["boom"],
          warnings: [],
          modules: [],
        }),
      );
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("logging=warn silences info but keeps warn and error", () => {
      loadClient("?logging=warn&overlayWarnings=true");
      const es = EventSourceStub.lastInstance();
      es.onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: ["something"],
          modules: [],
        }),
      );
      expect(
        console.info.mock.calls.some(([msg]) => /rebuilt/.test(String(msg))),
      ).toBe(false);
      expect(
        console.warn.mock.calls.some(([msg]) => /something/.test(String(msg))),
      ).toBe(true);
    });

    it("logging=error silences info and warn", () => {
      loadClient("?logging=error");
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: ["boom"],
          warnings: [],
          modules: [],
        }),
      );
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(
        console.error.mock.calls.some(([msg]) => /boom/.test(String(msg))),
      ).toBe(true);
    });
  });

  describe("with no EventSource", () => {
    beforeEach(() => {
      delete globalThis.EventSource;
      jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("emits a warning and does not connect", () => {
      loadClient();
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn.mock.calls[0][0]).toMatch(/EventSource/);
    });
  });
});
