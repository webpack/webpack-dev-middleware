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
    for (const el of document.querySelectorAll(
      "#webpack-dev-middleware-building-indicator",
    )) {
      el.remove();
    }
    delete globalThis.__resourceQuery;
    delete globalThis.EventSource;
    delete globalThis.__wdmEventSourceWrapper;
    delete globalThis.__webpack_dev_middleware_hot_reporter__;
    delete globalThis.__webpack_dev_middleware_hot_indicator_state__;
    jest.useRealTimers();
  });

  describe("with default options", () => {
    let EventSourceStub;
    let client;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "info").mockImplementation(() => {});
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "warn").mockImplementation(() => {});
      jest.spyOn(console, "error").mockImplementation(() => {});
      client = loadClient();
    });

    afterEach(() => {
      jest.restoreAllMocks();
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

    it("updates overlay when an errored build becomes a warning", () => {
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
      expect(clientOverlay.showProblems).toHaveBeenCalledTimes(2);
      expect(clientOverlay.showProblems).toHaveBeenLastCalledWith("warnings", [
        "This isn't great, but it's not terrible",
      ]);
      // The overlay content is replaced, not dismissed.
      expect(clientOverlay.clear).not.toHaveBeenCalled();
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
      expect(clientOverlay.showProblems).toHaveBeenCalledTimes(2);
      expect(clientOverlay.showProblems).toHaveBeenLastCalledWith("errors", [
        "Something broke",
        "Actually, 2 things broke",
      ]);
    });
  });

  describe("with multi-compiler payloads", () => {
    let EventSourceStub;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "info").mockImplementation(() => {});
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "warn").mockImplementation(() => {});
      jest.spyOn(console, "error").mockImplementation(() => {});
      loadClient();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("shows the union of problems from every broken bundle", () => {
      const es = EventSourceStub.lastInstance();
      es.onmessage(
        makeMessage({
          action: "built",
          name: "app",
          time: 100,
          hash: "app-hash",
          errors: ["app broke"],
          warnings: [],
        }),
      );
      es.onmessage(
        makeMessage({
          action: "built",
          name: "admin",
          time: 100,
          hash: "admin-hash",
          errors: ["admin broke too"],
          warnings: [],
        }),
      );
      expect(clientOverlay.showProblems).toHaveBeenLastCalledWith("errors", [
        "app broke",
        "admin broke too",
      ]);
    });
  });

  describe("with an overlay warnings filter function", () => {
    let EventSourceStub;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "info").mockImplementation(() => {});
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "warn").mockImplementation(() => {});
      loadClient(
        '?overlay={"warnings":"function(message){return message.includes(`keep`)}"}',
      );
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("only shows the warnings the filter keeps (dev-server parity)", () => {
      EventSourceStub.lastInstance().onmessage(
        makeMessage({
          action: "built",
          time: 100,
          hash: "1234567890abcdef",
          errors: [],
          warnings: ["drop this warning", "keep this warning"],
          modules: [],
        }),
      );
      expect(clientOverlay.showProblems).toHaveBeenCalledWith("warnings", [
        "keep this warning",
      ]);
    });
  });

  describe("with overlay warnings enabled via the dev-server-shaped option", () => {
    let EventSourceStub;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "info").mockImplementation(() => {});
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "warn").mockImplementation(() => {});
      jest.spyOn(console, "error").mockImplementation(() => {});
      loadClient('?overlay={"warnings":true}');
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
      expect(console.error.mock.calls).toMatchSnapshot();
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
      expect(clientOverlay.clear).toHaveBeenCalledWith("");
      expect(clientOverlay.clear).toHaveBeenCalledWith("runtime");
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
      jest.spyOn(console, "info").mockImplementation(() => {});
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "warn").mockImplementation(() => {});
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

  describe("with overlay runtime/trusted-types options", () => {
    it("forwards them to the overlay factory", () => {
      globalThis.EventSource = makeEventSourceStub();

      loadClient(
        '?overlay={"runtimeErrors":false,"trustedTypesPolicyName":"webpack#overlay","openEditorEndpoint":"/__open-editor"}',
      );

      const overlayFactory = require("../client-src/overlay");

      expect(overlayFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          catchRuntimeError: false,
          trustedTypesPolicyName: "webpack#overlay",
          openEditorEndpoint: "/__open-editor",
        }),
      );
    });
  });

  describe("with dynamicPublicPath", () => {
    let EventSourceStub;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "info").mockImplementation(() => {});
      jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      delete globalThis.__webpack_public_path__;
      jest.restoreAllMocks();
    });

    it("appends the SSE path to the public path like webpack appends filenames", () => {
      globalThis.__webpack_public_path__ = "/assets/";
      loadClient("?dynamicPublicPath=true");
      expect(EventSourceStub.lastInstance().url).toBe("/assets/__webpack_hmr");
    });

    it("preserves intentional double slashes inside the public path", () => {
      globalThis.__webpack_public_path__ = "https://host//rewritten/";
      loadClient("?dynamicPublicPath=true");
      expect(EventSourceStub.lastInstance().url).toBe(
        "https://host//rewritten/__webpack_hmr",
      );
    });

    it("does not produce a double slash when the public path has a trailing slash", () => {
      globalThis.__webpack_public_path__ = "https://localhost:3000/assets/";
      loadClient("?dynamicPublicPath=true");
      expect(EventSourceStub.lastInstance().url).toBe(
        "https://localhost:3000/assets/__webpack_hmr",
      );
    });
  });

  describe("with progress option", () => {
    const INDICATOR_ID = "webpack-dev-middleware-building-indicator";
    let EventSourceStub;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "info").mockImplementation(() => {});
      jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("keeps the badge until every compilation finished", () => {
      loadClient();
      const es = EventSourceStub.lastInstance();

      es.onmessage(makeMessage({ action: "building", name: "app" }));
      es.onmessage(makeMessage({ action: "building", name: "admin" }));

      es.onmessage(
        makeMessage({
          action: "built",
          name: "app",
          time: 1,
          hash: "h1",
          errors: [],
          warnings: [],
        }),
      );
      // "admin" is still building — its `built` has not arrived yet.
      expect(document.getElementById(INDICATOR_ID)).not.toBeNull();

      es.onmessage(
        makeMessage({
          action: "built",
          name: "admin",
          time: 1,
          hash: "h2",
          errors: [],
          warnings: [],
        }),
      );
      expect(document.getElementById(INDICATOR_ID)).toBeNull();
    });
  });

  describe("connection lifecycle", () => {
    let EventSourceStub;
    let client;

    beforeEach(() => {
      EventSourceStub = makeEventSourceStub();
      globalThis.EventSource = EventSourceStub;
      jest.spyOn(console, "info").mockImplementation(() => {});
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

    it("keeps the inactivity watchdog after a reconnect", () => {
      jest.useFakeTimers({ doNotFake: ["nextTick"] });
      delete globalThis.__wdmEventSourceWrapper;
      EventSourceStub.instances.length = 0;
      loadClient();

      // First silent stall: the watchdog disconnects and a reconnect opens a
      // second source 20s later.
      jest.advanceTimersByTime(30 * 1000);
      jest.advanceTimersByTime(20 * 1000);
      expect(EventSourceStub.instances).toHaveLength(2);

      // The reconnected source must be watched too: another silent stall has
      // to close it and schedule a third connection.
      const second = EventSourceStub.lastInstance();
      jest.advanceTimersByTime(30 * 1000);
      expect(second.closed).toBe(true);
      jest.advanceTimersByTime(20 * 1000);
      expect(EventSourceStub.instances).toHaveLength(3);
    });

    it("ignores error events that arrive after disconnect()", () => {
      jest.useFakeTimers({ doNotFake: ["nextTick"] });
      delete globalThis.__wdmEventSourceWrapper;
      EventSourceStub.instances.length = 0;
      const freshClient = loadClient();

      const [first] = EventSourceStub.instances;
      freshClient.disconnect();

      // An EventSource fires a queued error when its connection dies — it
      // must not resurrect the closed wrapper by scheduling a reconnect.
      first.dispatch("error", {});
      jest.advanceTimersByTime(60 * 1000);

      expect(EventSourceStub.instances).toHaveLength(1);
    });

    it("disconnect() drops the cached wrapper so a new connect starts fresh", () => {
      client.disconnect();
      expect(
        globalThis.__wdmEventSourceWrapper["/__webpack_hmr"],
      ).toBeUndefined();

      client.setOptionsAndConnect({});
      expect(EventSourceStub.instances).toHaveLength(2);
      expect(EventSourceStub.lastInstance().closed).toBe(false);
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
