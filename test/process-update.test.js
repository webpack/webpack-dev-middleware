/**
 * @jest-environment jsdom
 */

/** @typedef {{ status: jest.Mock, check: jest.Mock, apply: jest.Mock }} FakeHot */
/** @typedef {{ error: Error, moduleId: string, type: string }} ErroredEvent */
/** @typedef {{ onErrored: (event: ErroredEvent) => void }} FakeApplyOptions */

jest.mock("../client-src/utils/get-hot", () => jest.fn());
jest.mock("../client-src/utils/reload", () => jest.fn());

/**
 * Flush pending promise callbacks.
 * @returns {Promise<void>} resolved after one timer tick
 */
function flushPromises() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("process-update", () => {
  /** @type {jest.Mock} */
  let getHot;
  /** @type {jest.Mock} */
  let reloadPage;
  /** @type {typeof import("../client-src/process-update").default} */
  let applyUpdate;
  /** @type {(level: import("../client-src/utils/log").LogLevel) => void} */
  let setLogLevel;

  /**
   * @param {{ status?: string, checkResult?: string[] | null, applyImpl?: (options: FakeApplyOptions) => Promise<string[] | null> }=} behavior fake runtime behavior
   * @returns {FakeHot} fake `import.meta.webpackHot`
   */
  function makeFakeHot({
    status = "idle",
    checkResult = ["./a.js"],
    applyImpl = () => Promise.resolve(["./a.js"]),
  } = {}) {
    return {
      status: jest.fn(() => status),
      check: jest.fn(() => Promise.resolve(checkResult)),
      apply: jest.fn(applyImpl),
    };
  }

  /**
   * Load a fresh process-update with the given fake runtime configured in the
   * same module registry.
   * @param {FakeHot | undefined} hot fake `import.meta.webpackHot`
   * @returns {typeof import("../client-src/process-update").default} applyUpdate
   */
  function loadApplyUpdate(hot) {
    jest.resetModules();

    getHot = require("../client-src/utils/get-hot");
    getHot.mockReturnValue(hot);
    reloadPage = require("../client-src/utils/reload");
    reloadPage.mockReset();

    ({ setLogLevel } = require("../client-src/utils/log"));

    return require("../client-src/process-update").default;
  }

  beforeEach(() => {
    applyUpdate = loadApplyUpdate(makeFakeHot());

    // The bundle hash webpack injects; anything different from the payload
    // hash makes the client check for updates.
    globalThis.__webpack_hash__ = "current-hash";

    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setLogLevel("info");
    delete globalThis.__webpack_hash__;
    jest.restoreAllMocks();
  });

  it("logs an error once when the HMR runtime is disabled", () => {
    applyUpdate = loadApplyUpdate(undefined);

    expect(() => applyUpdate("h1", { reload: true })).not.toThrow();
    applyUpdate("h2", { reload: true });

    const runtimeErrors = console.error.mock.calls.filter((call) =>
      call.join(" ").includes("Hot Module Replacement is disabled"),
    );

    expect(runtimeErrors).toHaveLength(1);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  describe("multi-compiler bundles", () => {
    it("ignores events from sibling bundles once the own compilation is identified", async () => {
      // The `sync` sent on connect carries the bundle's own hash and locks the name.
      applyUpdate("current-hash", { reload: true }, "app");

      const hot = getHot();

      expect(hot.check).not.toHaveBeenCalled();

      // A sibling bundle rebuilds with a hash this runtime can never match.
      applyUpdate("admin-hash", { reload: true }, "admin");
      await flushPromises();

      expect(hot.check).not.toHaveBeenCalled();
      expect(reloadPage).not.toHaveBeenCalled();

      // The own bundle rebuilding still applies the update.
      applyUpdate("app-hash-2", { reload: true }, "app");
      globalThis.__webpack_hash__ = "app-hash-2";
      await flushPromises();

      expect(hot.check).toHaveBeenCalledWith(false);
      expect(hot.apply).toHaveBeenCalledTimes(1);
    });

    it("does not reload when a pre-lock sibling check resolves without an update", async () => {
      applyUpdate = loadApplyUpdate(makeFakeHot({ checkResult: null }));
      globalThis.__webpack_hash__ = "app-hash";

      // Connect-time catch-up: the sibling's sync arrives first and starts a
      // check against a manifest that was never emitted…
      applyUpdate("admin-hash", { reload: true }, "admin");
      // …and the own bundle's sync locks the name before that check resolves.
      applyUpdate("app-hash", { reload: true }, "app");
      await flushPromises();

      expect(getHot().check).toHaveBeenCalledTimes(1);
      expect(reloadPage).not.toHaveBeenCalled();
    });

    it("still checks named events while the own compilation is unknown", async () => {
      applyUpdate("new-hash", { reload: true }, "admin");
      globalThis.__webpack_hash__ = "new-hash";
      await flushPromises();

      expect(getHot().check).toHaveBeenCalledWith(false);
    });
  });

  it("checks and applies an update when the hash differs", async () => {
    applyUpdate("new-hash", { reload: true });
    globalThis.__webpack_hash__ = "new-hash";
    await flushPromises();

    const hot = getHot();

    expect(hot.check).toHaveBeenCalledWith(false);
    expect(hot.apply).toHaveBeenCalledTimes(1);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("does not check when already up to date", () => {
    applyUpdate("current-hash", { reload: true });

    expect(getHot().check).not.toHaveBeenCalled();
  });

  it("reloads when the update cannot be found (server restart)", async () => {
    applyUpdate = loadApplyUpdate(makeFakeHot({ checkResult: null }));

    applyUpdate("new-hash", { reload: true });
    await flushPromises();

    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("reloads when an accept handler errors during apply (onErrored)", async () => {
    applyUpdate = loadApplyUpdate(
      makeFakeHot({
        applyImpl: (applyOptions) => {
          applyOptions.onErrored({
            error: new Error("accept handler failed"),
            moduleId: "./a.js",
            type: "accept-errored",
          });

          return Promise.resolve(["./a.js"]);
        },
      }),
    );

    applyUpdate("new-hash", { reload: true });
    globalThis.__webpack_hash__ = "new-hash";
    await flushPromises();

    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("does not reload on errored apply when reload is disabled", async () => {
    applyUpdate = loadApplyUpdate(
      makeFakeHot({
        applyImpl: (applyOptions) => {
          applyOptions.onErrored({
            error: new Error("accept handler failed"),
            moduleId: "./a.js",
            type: "accept-errored",
          });

          return Promise.resolve(["./a.js"]);
        },
      }),
    );

    applyUpdate("new-hash", { reload: false });
    globalThis.__webpack_hash__ = "new-hash";
    await flushPromises();

    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("reloads when modules could not be hot updated (unaccepted)", async () => {
    applyUpdate = loadApplyUpdate(
      makeFakeHot({
        checkResult: ["./a.js", "./b.js"],
        // Only one of the two updated modules was renewed.
        applyImpl: () => Promise.resolve(["./a.js"]),
      }),
    );

    applyUpdate("new-hash", { reload: true });
    globalThis.__webpack_hash__ = "new-hash";
    await flushPromises();

    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("reloads when the runtime reports a failure status", async () => {
    const hot = {
      // "idle" when the update starts, "abort" when the failure is handled.
      status: jest.fn().mockReturnValueOnce("idle").mockReturnValue("abort"),
      check: jest.fn(() => Promise.reject(new Error("check failed"))),
      apply: jest.fn(() => Promise.resolve([])),
    };

    applyUpdate = loadApplyUpdate(hot);

    applyUpdate("new-hash", { reload: true });
    await flushPromises();

    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  describe("logging", () => {
    /**
     * @param {jest.Mock} spy console spy
     * @param {string} text expected substring
     * @returns {boolean} true when some call contains the text
     */
    function logged(spy, text) {
      return spy.mock.calls.some((call) => call.join(" ").includes(text));
    }

    beforeEach(() => {
      if (typeof console.groupCollapsed !== "function") {
        console.groupCollapsed = () => {};
      }
      if (typeof console.groupEnd !== "function") {
        console.groupEnd = () => {};
      }
      jest.spyOn(console, "groupCollapsed").mockImplementation(() => {});
      jest.spyOn(console, "groupEnd").mockImplementation(() => {});
    });

    it("logs a one-line summary at the default info level", async () => {
      applyUpdate = loadApplyUpdate(
        makeFakeHot({
          checkResult: ["./a.js", "./b.js"],
          applyImpl: () => Promise.resolve(["./a.js", "./b.js"]),
        }),
      );

      applyUpdate("new-hash", { reload: true });
      globalThis.__webpack_hash__ = "new-hash";
      await flushPromises();

      expect(logged(console.info, "Hot updated 2 modules.")).toBe(true);
      // Groups are gated below the "log" level.
      expect(console.groupCollapsed).not.toHaveBeenCalled();
      expect(logged(console.log, "./a.js")).toBe(false);
    });

    it("adds a collapsed group with the module detail at the log level", async () => {
      applyUpdate = loadApplyUpdate(
        makeFakeHot({
          checkResult: ["./a.js", "./b.js"],
          applyImpl: () => Promise.resolve(["./a.js", "./b.js"]),
        }),
      );
      setLogLevel("log");

      applyUpdate("new-hash", { reload: true });
      globalThis.__webpack_hash__ = "new-hash";
      await flushPromises();

      expect(logged(console.info, "Hot updated 2 modules.")).toBe(true);
      expect(
        logged(
          /** @type {jest.Mock} */ (console.groupCollapsed),
          "Updated modules:",
        ),
      ).toBe(true);
      expect(logged(console.log, "./a.js")).toBe(true);
      expect(logged(console.log, "./b.js")).toBe(true);
      expect(console.groupEnd).toHaveBeenCalled();
    });
  });
});
