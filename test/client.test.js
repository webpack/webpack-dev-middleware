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
