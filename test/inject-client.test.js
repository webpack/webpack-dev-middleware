import webpack from "webpack";

import injectHotClient, { isWebTarget } from "../src/injectClient";

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

// Every target webpack resolves a platform from, so a change to the check has
// to say which of these it meant to move. `electron-renderer` and `nwjs` are
// browsers that also have node; `webworker` has no document but does have the
// transport — webpack-dev-server has always given both a client.
describe("which targets get a client", () => {
  const WEB = [
    ["nothing, so webpack's default", undefined],
    ["web", "web"],
    ["webworker", "webworker"],
    ["electron-renderer", "electron-renderer"],
    ["electron13-renderer", "electron13-renderer"],
    ["electron-preload", "electron-preload"],
    ["nwjs", "nwjs"],
    ["node-webkit", "node-webkit"],
    ["deno", "deno"],
    ["browserslist: last 2 versions", "browserslist: last 2 versions"],
    ['["web", "es5"]', ["web", "es5"]],
    ['["node", "web"], a universal target', ["node", "web"]],
    ['["webworker", "node"], also universal', ["webworker", "node"]],
  ];

  const NOT_WEB = [
    ["node", "node"],
    ["node14", "node14"],
    ["async-node", "async-node"],
    ["electron-main", "electron-main"],
    ['["electron-main", "node"]', ["electron-main", "node"]],
  ];

  /** @type {EXPECTED_OBJECT[]} */
  let compilers = [];

  afterEach(() => {
    for (const compiler of compilers) {
      compiler.close(() => {});
    }

    compilers = [];
  });

  /**
   * @param {EXPECTED_OBJECT} target webpack target
   * @param {EXPECTED_OBJECT=} extra extra webpack configuration
   * @returns {boolean} whether the client belongs in it
   */
  function verdict(target, extra = {}) {
    const compiler = makeCompiler(
      target === undefined ? extra : { target, ...extra },
    );

    compilers.push(compiler);

    return isWebTarget(compiler);
  }

  for (const [label, target] of WEB) {
    it(`gives one to ${label}`, () => {
      expect(verdict(target)).toBe(true);
    });
  }

  for (const [label, target] of NOT_WEB) {
    it(`gives none to ${label}`, () => {
      expect(verdict(target)).toBe(false);
    });
  }

  it("gives none to a target that names no platform", () => {
    // `target: false` is null everywhere, exactly like a universal target, so
    // it is told apart by the target itself rather than by the platform.
    expect(
      verdict(false, {
        output: { chunkFormat: "array-push", chunkLoading: "jsonp" },
      }),
    ).toBe(false);
  });
});

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

  // What happens to a project written against the README as it was before
  // anything was injected for it. Nothing here should have to change.
  describe("upgrading a project that wired hot itself", () => {
    /**
     * @returns {EXPECTED_OBJECT} the setup the README used to document
     */
    function documentedSetup() {
      return compiler({
        entry: ["webpack-dev-middleware/client", "./app.js"],
        plugins: [new webpack.HotModuleReplacementPlugin()],
      });
    }

    it("adds neither a second client nor a second plugin", () => {
      const instance = documentedSetup();
      const before = entryCount(instance);
      const pluginsBefore = instance.hooks.compilation.taps.filter(
        (tap) => tap.name === "HotModuleReplacementPlugin",
      ).length;

      injectHotClient(
        [instance],
        { path: "/__webpack_hmr", transport: "sse" },
        logger,
      );

      expect(entryCount(instance)).toBe(before);
      expect(
        instance.hooks.compilation.taps.filter(
          (tap) => tap.name === "HotModuleReplacementPlugin",
        ),
      ).toHaveLength(pluginsBefore);
    });

    it("says the plugin is now redundant", () => {
      injectHotClient(
        [documentedSetup()],
        { path: "/__webpack_hmr", transport: "sse" },
        logger,
      );

      expect(warnings.join("\n")).toContain(
        "applies HotModuleReplacementPlugin",
      );
    });

    it("adds the plugin to a project that only had the client entry", () => {
      // This one was broken before: the client was there, nothing applied the
      // update, and the runtime said so on every build.
      const instance = compiler({
        entry: ["webpack-dev-middleware/client", "./app.js"],
      });

      injectHotClient(
        [instance],
        { path: "/__webpack_hmr", transport: "sse" },
        logger,
      );

      expect(hasHmrPlugin(instance)).toBe(true);
      expect(warnings).toStrictEqual([]);
    });
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
