import webpack from "webpack";

import injectHotClient from "../src/injectClient";

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_OBJECT */

/**
 * @param {EXPECTED_OBJECT} compiler compiler
 * @returns {number} how many entries the compilation has
 */
function entryCount(compiler) {
  return compiler.hooks.make.taps.filter((tap) => tap.name === "EntryPlugin")
    .length;
}

/**
 * @param {EXPECTED_OBJECT} compiler compiler
 * @returns {boolean} whether HotModuleReplacementPlugin was applied
 */
function hasHmrPlugin(compiler) {
  return compiler.hooks.compilation.taps.some(
    (tap) => tap.name === "HotModuleReplacementPlugin",
  );
}

/**
 * @param {EXPECTED_OBJECT=} config extra webpack configuration
 * @returns {EXPECTED_OBJECT} a compiler that has not been run
 */
function makeCompiler(config = {}) {
  return webpack({ entry: "./app.js", mode: "development", ...config });
}

describe("injectHotClient", () => {
  /** @type {EXPECTED_OBJECT[]} */
  let compilers = [];
  /** @type {string[]} */
  let warnings = [];
  /** @type {EXPECTED_OBJECT} */
  const logger = {
    warn: (message) => warnings.push(message),
    log: () => {},
  };

  afterEach(() => {
    for (const compiler of compilers) {
      compiler.close(() => {});
    }

    compilers = [];
    warnings = [];
  });

  /**
   * @param {EXPECTED_OBJECT=} config extra webpack configuration
   * @returns {EXPECTED_OBJECT} tracked compiler
   */
  function compiler(config) {
    const created = makeCompiler(config);

    compilers.push(created);

    return created;
  }

  it("adds the client and the plugin", () => {
    const instance = compiler();
    const before = entryCount(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse" },
      logger,
    );

    expect(entryCount(instance)).toBe(before + 1);
    expect(hasHmrPlugin(instance)).toBe(true);
  });

  it("leaves a compilation that already has the client alone", () => {
    const instance = compiler({
      entry: ["webpack-dev-middleware/client", "./app.js"],
    });
    const before = entryCount(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse" },
      logger,
    );

    expect(entryCount(instance)).toBe(before);
  });

  it("still adds the client next to another of the package's exports", () => {
    // `client/overlay` is a real export and does not connect to anything, so
    // finding one is not finding the client.
    const instance = compiler({
      entry: ["webpack-dev-middleware/client/overlay", "./app.js"],
    });
    const before = entryCount(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse" },
      logger,
    );

    expect(entryCount(instance)).toBe(before + 1);
  });

  it("recognises the client carrying a query", () => {
    const instance = compiler({
      entry: ["webpack-dev-middleware/client?overlay=false", "./app.js"],
    });
    const before = entryCount(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse" },
      logger,
    );

    expect(entryCount(instance)).toBe(before);
  });

  describe("with a transport of your own", () => {
    const transport = () => ({
      close: () => {},
      onConnect: () => {},
      publish: () => {},
      publishTo: () => {},
    });

    it("adds no client, since the built-in one cannot speak it", () => {
      const instance = compiler();
      const before = entryCount(instance);

      injectHotClient(
        [instance],
        { path: "/__webpack_hmr", transport },
        logger,
      );

      // A client configured for Server-Sent Events would ask for a stream the
      // custom transport may not serve, and never connect.
      expect(entryCount(instance)).toBe(before);
      expect(warnings.join("\n")).toContain("no client was added");
    });

    it("still applies the plugin", () => {
      const instance = compiler();

      injectHotClient(
        [instance],
        { path: "/__webpack_hmr", transport },
        logger,
      );

      // Which transport carries the events has nothing to do with the runtime
      // that applies them.
      expect(hasHmrPlugin(instance)).toBe(true);
    });

    it("says so once, not once per compilation", () => {
      const first = compiler();
      const second = compiler();

      injectHotClient(
        [first, second],
        { path: "/__webpack_hmr", transport },
        logger,
      );

      expect(warnings).toHaveLength(1);
    });

    it("says nothing to someone who already wired their own client", () => {
      const instance = compiler({
        entry: [
          "./my-hot-client.js",
          "webpack-dev-middleware/client",
          "./app.js",
        ],
      });

      injectHotClient(
        [instance],
        { path: "/__webpack_hmr", transport },
        logger,
      );

      expect(warnings).toStrictEqual([]);
    });
  });
});
