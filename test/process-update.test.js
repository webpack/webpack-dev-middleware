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
});
