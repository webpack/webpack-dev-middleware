import fs from "node:fs";
import path from "node:path";

import webpack from "webpack";

import schema from "../src/options.json";
import {
  clientQuery,
  filterSource,
  hasClientEntry,
  injectHotClient,
  isWebTarget,
} from "../src/utils";

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
    // No document, but the transports and webpack's runtime are all an update
    // needs — `test/e2e/worker.test.js` runs one.
    ["webworker", "webworker"],
    ["electron-renderer", "electron-renderer"],
    ["electron13-renderer", "electron13-renderer"],
    ["electron-preload", "electron-preload"],
    ["nwjs", "nwjs"],
    ["node-webkit", "node-webkit"],
    ["browserslist: last 2 versions", "browserslist: last 2 versions"],
    ['["web", "es5"]', ["web", "es5"]],
    ['["node", "web"], a universal target', ["node", "web"]],
    ['["webworker", "node"], also universal', ["webworker", "node"]],
  ];

  const NOT_WEB = [
    // Deno is a context webpack calls `web`, and the client's transports
    // there are untested — unlike a worker, which is in the list above.
    ["deno", "deno"],
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

  // `Infinity` is "keep trying" in node, and JSON writes it as `null`, which the
  // client drops — leaving a server that asked for endless retries with the
  // default number.
  describe("an option that has no spelling in JSON", () => {
    it("sends endless retries as a number the client keeps", () => {
      const query = clientQuery({ connect: { retries: Infinity } });
      const { retries } = JSON.parse(query.connect);

      expect(retries).toBe(Number.MAX_SAFE_INTEGER);
    });

    // A timeout is also the delay handed to `setTimeout`, which wraps above
    // 2^31 - 1 milliseconds and would fire at once — so turning an infinite one
    // into a huge number would have the client reconnect in a loop.
    it("does not turn an infinite timeout into a delay", () => {
      const query = clientQuery({ connect: { timeout: Infinity } });
      const { timeout } = JSON.parse(query.connect);

      expect(timeout).toBeNull();
    });

    it("leaves a finite count as it was", () => {
      const query = clientQuery({ connect: { retries: 3, timeout: 1000 } });

      expect(JSON.parse(query.connect)).toEqual({ retries: 3, timeout: 1000 });
    });
  });

  // Applying a build by reloading the page, or not at all, has no use for the
  // HMR runtime, so it is not added to a bundle that will never run it.
  describe("the plugin for the modes that do not use it", () => {
    const cases = [
      ["hmr", true],
      ["hmr-only", true],
      ["reload", false],
      ["nothing", false],
      [undefined, true],
    ];

    for (const [apply, expected] of cases) {
      it(`${apply === undefined ? "no apply" : `apply: ${apply}`} ${expected ? "applies" : "does not apply"} HotModuleReplacementPlugin`, () => {
        const instance = makeCompiler();

        injectHotClient(
          [instance],
          {
            path: "/__webpack_hmr",
            transport: "sse",
            client: apply ? { apply } : undefined,
          },
          logger,
        );

        expect(hasHmrPlugin(instance)).toBe(expected);
        // The client is added either way: reloading is something it does.
        expect(entryCount(instance)).toBeGreaterThan(0);
      });
    }

    it("keeps a plugin the configuration already has, without calling it redundant", () => {
      const instance = makeCompiler({
        plugins: [new webpack.HotModuleReplacementPlugin()],
      });

      injectHotClient(
        [instance],
        {
          path: "/__webpack_hmr",
          transport: "sse",
          client: { apply: "reload" },
        },
        logger,
      );

      expect(hasHmrPlugin(instance)).toBe(true);
      expect(warnings.join("\n")).not.toContain(
        "applies HotModuleReplacementPlugin",
      );
    });
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

    // The hazard this guards: a required token only reaches the browser on
    // the entry added here, so asking for one where no entry is added would
    // refuse every client with an unexplained 403.
    it("says a token was required that no client was given", () => {
      injectHotClient(
        [documentedSetup()],
        {
          path: "/__webpack_hmr",
          transport: "sse",
          token: "a-token-nobody-gets",
        },
        logger,
      );

      expect(warnings.join("\n")).toContain(
        "no client entry was added to hand one over",
      );
      // Not the token itself: a minted one is stale by the time anyone reads
      // the warning, and infrastructure warnings travel into CI output.
      expect(warnings.join("\n")).not.toContain("a-token-nobody-gets");
      expect(warnings.join("\n")).toContain("token=<the token>");
    });

    it("says nothing about a token when the client was injected", () => {
      injectHotClient(
        [compiler({ entry: "./app.js" })],
        { path: "/__webpack_hmr", transport: "sse", token: "handed-over" },
        logger,
      );

      expect(warnings.join("\n")).not.toContain("no client entry was added");
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

  it("does not mistake the project's own client folder for this one", () => {
    // `./src/client/index.js` is an ordinary application entry, and a common
    // one. Reading it as this package's client leaves the page with no client
    // at all, which is worse than the duplicate it was guarding against.
    const instance = compiler({ entry: "./src/client/index.js" });
    const before = entryCount(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse" },
      logger,
    );

    expect(entryCount(instance)).toBe(before + 1);
  });

  it("recognises this package's client asked for by path", () => {
    const instance = compiler({
      entry: [require.resolve("../client-src/index.js"), "./app.js"],
    });
    const before = entryCount(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse" },
      logger,
    );

    expect(entryCount(instance)).toBe(before);
  });

  it("gives a client to the entry points that lack one, and only those", () => {
    // Separate pages: one already has the client, the other would connect to
    // nothing without one of its own.
    const instance = compiler({
      entry: {
        landing: ["webpack-dev-middleware/client", "./landing.js"],
        dashboard: "./dashboard.js",
        admin: "./admin.js",
      },
    });
    const before = entryCount(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse" },
      logger,
    );

    // Two added, for `dashboard` and `admin` — not one global entry, which
    // would have given `landing` a second client.
    expect(entryCount(instance)).toBe(before + 2);
  });

  it("adds one entry for them all when none has a client", () => {
    const instance = compiler({
      entry: { landing: "./landing.js", dashboard: "./dashboard.js" },
    });
    const before = entryCount(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse" },
      logger,
    );

    expect(entryCount(instance)).toBe(before + 1);
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

// An overlay filter travels to the browser as its own source, which the client
// puts after `var callback = `. Not every function stringifies into something
// that can stand there.
describe("serializing an overlay filter", () => {
  /**
   * @param {string} source the serialized filter
   * @returns {boolean} whether the client could rebuild it
   */
  function theClientCanRebuild(source) {
    try {
      // The same shape `decodeOverlayOptions` builds in the browser.
      // eslint-disable-next-line no-new-func
      const rebuilt = new Function(
        "message",
        `var callback = ${source}\n return callback(message)`,
      );

      return typeof rebuilt === "function";
    } catch {
      return false;
    }
  }

  /**
   * @param {EXPECTED_OBJECT} message a problem
   * @returns {boolean} whether to show it
   */
  function classicFilter(message) {
    return message.text.length > 0;
  }

  const arrowFilter = (message) => message.text.length > 0;

  const { errors: shorthandFilter } = {
    errors(message) {
      return message.text.length > 0;
    },
  };

  it("keeps an arrow function as it is", () => {
    expect(filterSource("errors", arrowFilter)).toBe(arrowFilter.toString());
    expect(theClientCanRebuild(filterSource("errors", arrowFilter))).toBe(true);
  });

  it("keeps a function as it is", () => {
    expect(filterSource("warnings", classicFilter)).toBe(
      classicFilter.toString(),
    );
    expect(theClientCanRebuild(filterSource("warnings", classicFilter))).toBe(
      true,
    );
  });

  it("makes a method shorthand into something assignable", () => {
    // `overlay: { errors(message) { ... } }` stringifies to
    // `errors(message) { ... }`, which is not an expression — the client threw
    // on it before this.
    expect(theClientCanRebuild(shorthandFilter.toString())).toBe(false);
    expect(theClientCanRebuild(filterSource("errors", shorthandFilter))).toBe(
      true,
    );
  });

  it("says which option it could not serialize", () => {
    // Nothing makes this assignable, and a stack in the browser would point at
    // the client rather than at the configuration.
    const unusable = { toString: () => "!!! not a function !!!" };

    expect(() => filterSource("runtimeErrors", unusable)).toThrow(
      /'hot.client.overlay.runtimeErrors'/,
    );
  });
});

// What `hot.client` becomes in the entry's query. The shapes differ enough
// that each is worth stating: a plain value, `overlay` as a boolean, and
// `overlay` as an object whose filters travel as source.
describe("the browser options as a query", () => {
  it("passes a plain option through as text", () => {
    expect(clientQuery({ logging: "warn", name: "admin" })).toStrictEqual({
      logging: "warn",
      name: "admin",
    });
  });

  it("leaves out what was not set", () => {
    expect(clientQuery({ logging: undefined, connect: false })).toStrictEqual({
      connect: "false",
    });
  });

  it("takes no options at all", () => {
    expect(clientQuery()).toStrictEqual({});
  });

  it("keeps a boolean overlay a boolean", () => {
    expect(clientQuery({ overlay: false })).toStrictEqual({
      overlay: "false",
    });
  });

  it("sends an overlay object as json, filters as source", () => {
    const query = clientQuery({
      overlay: {
        warnings: false,
        trustedTypesPolicyName: "mine",
        errors: (message) => message.text.length > 0,
      },
    });
    const overlay = JSON.parse(query.overlay);

    // Flags and strings survive as themselves; only a filter is encoded.
    expect(overlay.warnings).toBe(false);
    expect(overlay.trustedTypesPolicyName).toBe("mine");
    // Rebuilt the way the client rebuilds it, then asked: the source's exact
    // spelling is the formatter's business, what it does is not.
    // eslint-disable-next-line no-new-func
    const rebuilt = new Function(
      "message",
      `var callback = ${decodeURIComponent(overlay.errors)}\n return callback(message)`,
    );

    expect(rebuilt({ text: "boom" })).toBe(true);
    expect(rebuilt({ text: "" })).toBe(false);
  });

  // `connect` is the second option that may be an object, and its contents
  // only reach the client if they travel as json: `String(value)` would make
  // it `"[object Object]"`, which the client fails to parse and then reads as
  // the boolean `true`, dropping `retries` and `timeout` without a word.
  it("sends a connect object as json", () => {
    expect(
      clientQuery({ connect: { retries: 3, timeout: 5000 } }),
    ).toStrictEqual({ connect: '{"retries":3,"timeout":5000}' });
  });

  // A spec replaces the resolved path in the query outright, so the part it
  // leaves out has to be carried over. The client's own fallback is the same
  // path only until someone sets `hot.path`, and then quietly is not.
  it("carries the resolved path into a spec that names no pathname", () => {
    expect(clientQuery({ url: { port: 8080 } }, "/custom-hmr")).toStrictEqual({
      url: '{"port":8080,"pathname":"/custom-hmr"}',
    });
  });

  // Empty is not a path, so it means the same as not saying one. Left as it
  // was, the client would resolve it from its own default rather than from
  // this server's — the same silent mismatch an absent one would cause.
  it("carries the resolved path into a spec whose pathname is empty", () => {
    expect(
      clientQuery({ url: { port: 8080, pathname: "" } }, "/custom-hmr"),
    ).toStrictEqual({ url: '{"port":8080,"pathname":"/custom-hmr"}' });
  });

  it("leaves a pathname the spec named alone", () => {
    expect(
      clientQuery({ url: { port: 8080, pathname: "/mine" } }, "/custom-hmr"),
    ).toStrictEqual({ url: '{"port":8080,"pathname":"/mine"}' });
  });

  // The client decides which shape it was handed by what the json parses to,
  // not by the first character — so padding cannot hide the object, and a
  // bare number or boolean is not mistaken for one. Serialization is what
  // this file covers; the browser end is in `test/e2e/transport.test.js`.
  it("serializes a spec as json a parser can find", () => {
    const query = clientQuery({ url: { port: 8080 } }, "/hmr");

    expect(JSON.parse(query.url)).toStrictEqual({
      port: 8080,
      pathname: "/hmr",
    });
  });

  it("does not reach into a path given as a string", () => {
    expect(clientQuery({ url: "/plain" }, "/custom-hmr")).toStrictEqual({
      url: "/plain",
    });
  });

  it("keeps a boolean connect a boolean", () => {
    expect(clientQuery({ connect: false })).toStrictEqual({ connect: "false" });
  });

  // The rule is the value's shape rather than the option's name, so an option
  // that grows an object form later travels without a change here.
  it("sends any object-valued option as json", () => {
    const query = clientQuery({ connect: { retries: 1 }, logging: "warn" });

    for (const [key, value] of Object.entries(query)) {
      expect(value).not.toContain("[object Object]");
      expect(typeof value).toBe("string");
      expect(key).toBeTruthy();
    }
  });
});

describe("what injectHotClient leaves alone", () => {
  /** @type {EXPECTED_OBJECT[]} */
  let compilers = [];
  /** @type {EXPECTED_OBJECT} */
  const logger = { warn: () => {}, log: () => {} };

  afterEach(() => {
    for (const compiler of compilers) {
      compiler.close(() => {});
    }

    compilers = [];
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

  it("adds nothing at all when inject is off", () => {
    const instance = compiler();
    const before = entryCount(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse", inject: false },
      logger,
    );

    expect(entryCount(instance)).toBe(before);
    expect(hasHmrPlugin(instance)).toBe(false);
  });

  it("gives a compilation a browser does not run the plugin, not the client", () => {
    // A server bundle hot-reloads itself through `module.hot` too — with
    // `webpack/hot/poll` or `webpack/hot/signal` — and webpack-dev-server has
    // always applied the plugin to every compilation it serves, so a project
    // relying on that has none of its own.
    const instance = compiler({ target: "node" });
    const before = entryCount(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse" },
      logger,
    );

    expect(entryCount(instance)).toBe(before);
    expect(hasHmrPlugin(instance)).toBe(true);
  });

  it("gives that compilation no plugin either in a mode that never applies an update", () => {
    const instance = compiler({ target: "node" });

    injectHotClient(
      [instance],
      {
        path: "/__webpack_hmr",
        transport: "sse",
        client: { apply: "reload" },
      },
      logger,
    );

    expect(hasHmrPlugin(instance)).toBe(false);
  });

  it("adds no client but still the plugin when the client is off", () => {
    // A page that wires a runtime of its own still wants its updates applied,
    // which takes the plugin.
    const instance = compiler();
    const before = entryCount(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse", client: false },
      logger,
    );

    expect(entryCount(instance)).toBe(before);
    expect(hasHmrPlugin(instance)).toBe(true);
  });

  it("does not warn about a token it never had a client to hand to, when the client is off", () => {
    /** @type {string[]} */
    const warned = [];
    const instance = compiler();

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse", client: false },
      { warn: (message) => warned.push(message), log: () => {} },
    );

    expect(warned).toStrictEqual([]);
  });

  it("treats an entry it cannot read as having no client", () => {
    // A function `entry` is computed per build, so there is nothing to look
    // at — the client goes in, which is the safe way to be wrong.
    const instance = compiler({ entry: () => "./app.js" });
    const before = entryCount(instance);

    expect(hasClientEntry(instance)).toBe(false);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport: "sse" },
      logger,
    );

    expect(entryCount(instance)).toBe(before + 1);
  });

  it("says a compilation that has the client already has it", () => {
    const instance = compiler({
      entry: ["webpack-dev-middleware/client", "./app.js"],
    });

    expect(hasClientEntry(instance)).toBe(true);
  });
});

// Every browser option has two spellings — `hot.client` in node, and the
// injected entry's query — and they end in the same place. `transport`, `path`
// and `name` are the ones the middleware knows a value for, so what matters
// there is which of the two wins.
describe("the entry query the client is given", () => {
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
   * Inject with an `EntryPlugin` that records instead of applying, and report
   * the query each added entry carries.
   * @param {EXPECTED_OBJECT} options resolved hot options
   * @param {EXPECTED_OBJECT=} config extra webpack configuration
   * @returns {Record<string, string>[]} one parsed query per entry added
   */
  function queries(options, config) {
    const instance = makeCompiler(config);

    compilers.push(instance);

    /** @type {string[]} */
    const added = [];
    const real = instance.webpack;

    class RecordingEntryPlugin {
      /**
       * @param {string} _context context
       * @param {string} entry entry request
       */
      constructor(_context, entry) {
        added.push(entry);
      }

      apply() {}
    }

    instance.webpack = { ...real, EntryPlugin: RecordingEntryPlugin };

    try {
      injectHotClient([instance], options, logger);
    } finally {
      instance.webpack = real;
    }

    return added.map((entry) =>
      Object.fromEntries(new URLSearchParams(entry.split("?")[1])),
    );
  }

  it("carries the endpoint and the transport the middleware resolved", () => {
    expect(queries({ path: "/__hmr", transport: "ws" })).toStrictEqual([
      { url: "/__hmr", transport: "ws" },
    ]);
  });

  it("names the compilation, so a client ignores its siblings", () => {
    expect(
      queries({ path: "/__webpack_hmr", transport: "sse" }, { name: "admin" }),
    ).toStrictEqual([
      { url: "/__webpack_hmr", transport: "sse", name: "admin" },
    ]);
  });

  it("carries every browser option set in node", () => {
    const [query] = queries({
      path: "/__webpack_hmr",
      transport: "sse",
      client: {
        apply: "reload",
        connect: false,
        pageParamPrefix: "my-server",
        logging: "warn",
        dynamicPublicPath: true,
        progress: "linear",
        overlay: false,
      },
    });

    expect(query).toStrictEqual({
      url: "/__webpack_hmr",
      transport: "sse",
      apply: "reload",
      connect: "false",
      pageParamPrefix: "my-server",
      logging: "warn",
      dynamicPublicPath: "true",
      progress: "linear",
      overlay: "false",
    });
  });

  it("lets the three the middleware knows be overridden", () => {
    // A page behind a proxy reaches the endpoint on another origin, and its
    // client is no longer one this middleware can address. Written in node, so
    // it is the same option object as everything else.
    const [query] = queries(
      { path: "/__webpack_hmr", transport: "sse" },
      { name: "admin" },
    );

    expect(query).toMatchObject({ url: "/__webpack_hmr", name: "admin" });

    const [overridden] = queries(
      {
        path: "/__webpack_hmr",
        transport: "sse",
        client: {
          url: "wss://dev.example.com/__hmr",
          transport: "ws",
          name: "",
        },
      },
      { name: "admin" },
    );

    expect(overridden).toStrictEqual({
      url: "wss://dev.example.com/__hmr",
      transport: "ws",
      name: "",
    });
  });

  it("adds a client for a transport of your own that speaks a built-in one", () => {
    // The stream is yours; what goes over it is Server-Sent Events, so the
    // built-in client can speak to it once it is told so.
    const transport = () => ({
      close: () => {},
      onConnect: () => {},
      publish: () => {},
      publishTo: () => {},
    });

    expect(
      queries({
        path: "/__webpack_hmr",
        transport,
        client: { transport: "sse" },
      }),
    ).toStrictEqual([{ url: "/__webpack_hmr", transport: "sse" }]);
    expect(warnings).toStrictEqual([]);
  });

  it("still adds none for one that speaks neither", () => {
    const transport = () => ({
      close: () => {},
      onConnect: () => {},
      publish: () => {},
      publishTo: () => {},
    });

    expect(queries({ path: "/__webpack_hmr", transport })).toStrictEqual([]);
    expect(warnings.join("\n")).toContain("hot.client.transport");
  });
});

// `hot.client.transport` naming a module rather than a wire: a client class of
// someone else's, which the runtime uses in place of the built-in one through
// `__webpack_dev_server_client__`. webpack-dev-server's
// `client.webSocketTransport` has always worked this way.
describe("a client transport of someone else's", () => {
  const CUSTOM = path.resolve(__dirname, "fixtures/custom-client-transport.js");

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
   * Inject with an `EntryPlugin` and a `ProvidePlugin` that record instead of
   * applying.
   * @param {EXPECTED_OBJECT} options resolved hot options
   * @param {EXPECTED_OBJECT=} config extra webpack configuration
   * @returns {{ queries: Record<string, string>[], provided: Record<string, string>[] }} what was added
   */
  function inject(options, config) {
    const instance = makeCompiler(config);

    compilers.push(instance);

    /** @type {string[]} */
    const added = [];
    /** @type {Record<string, string>[]} */
    const provided = [];
    const real = instance.webpack;

    class RecordingEntryPlugin {
      /**
       * @param {string} _context context
       * @param {string} entry entry request
       */
      constructor(_context, entry) {
        added.push(entry);
      }

      apply() {}
    }

    class RecordingProvidePlugin {
      /**
       * @param {Record<string, string>} definitions what is provided
       */
      constructor(definitions) {
        provided.push(definitions);
      }

      apply() {}
    }

    instance.webpack = {
      ...real,
      EntryPlugin: RecordingEntryPlugin,
      ProvidePlugin: RecordingProvidePlugin,
    };

    try {
      injectHotClient([instance], options, logger);
    } finally {
      instance.webpack = real;
    }

    return {
      queries: added.map((entry) =>
        Object.fromEntries(new URLSearchParams(entry.split("?")[1])),
      ),
      provided,
    };
  }

  it("hands the runtime the module, resolved", () => {
    const { provided } = inject({
      path: "/__webpack_hmr",
      transport: "ws",
      client: { transport: CUSTOM },
    });

    expect(provided).toStrictEqual([{ __webpack_dev_server_client__: CUSTOM }]);
  });

  it("resolves a relative request from the compilation's context", () => {
    const { provided } = inject(
      {
        path: "/__webpack_hmr",
        transport: "ws",
        client: { transport: "./custom-client-transport.js" },
      },
      { context: path.resolve(__dirname, "fixtures") },
    );

    expect(provided).toStrictEqual([{ __webpack_dev_server_client__: CUSTOM }]);
  });

  it("puts the endpoint's wire on the query, not the module", () => {
    // The runtime still works out the url's scheme and how to hold the
    // connection open from the wire, and a path there would be neither.
    const { queries } = inject({
      path: "/__webpack_hmr",
      transport: "sse",
      client: { transport: CUSTOM },
    });

    expect(queries).toStrictEqual([
      { url: "/__webpack_hmr", transport: "sse" },
    ]);
  });

  it("does not call it a disagreement with the endpoint", () => {
    inject({
      path: "/__webpack_hmr",
      transport: "ws",
      client: { transport: CUSTOM },
    });

    expect(warnings).toStrictEqual([]);
  });

  it("adds a client to a transport of your own on the server as well", () => {
    // Both ends are someone else's, so the runtime is told a WebSocket — the
    // wire webpack-dev-server has always built a custom client's url for.
    const { queries, provided } = inject({
      path: "/ws",
      transport: () => ({
        close: () => {},
        onConnect: () => {},
        publish: () => {},
        publishTo: () => {},
      }),
      client: { transport: CUSTOM },
    });

    expect(queries).toStrictEqual([{ url: "/ws", transport: "ws" }]);
    expect(provided).toHaveLength(1);
    expect(warnings).toStrictEqual([]);
  });

  it("provides nothing for a built-in transport", () => {
    const { provided } = inject({
      path: "/__webpack_hmr",
      transport: "ws",
      client: { transport: "ws" },
    });

    expect(provided).toStrictEqual([]);
  });

  it("provides nothing to a compilation a browser does not run", () => {
    const { provided } = inject(
      {
        path: "/__webpack_hmr",
        transport: "ws",
        client: { transport: CUSTOM },
      },
      { target: "node" },
    );

    expect(provided).toStrictEqual([]);
  });

  it("says which module it could not find", () => {
    expect(() =>
      inject({
        path: "/__webpack_hmr",
        transport: "ws",
        client: { transport: "./no-such-client.js" },
      }),
    ).toThrow(
      /'hot\.client\.transport'.*'\.\/no-such-client\.js' could not be resolved/,
    );
  });

  it("is accepted by the schema", () => {
    const client = schema.definitions.HotClient;

    expect(client.properties.transport.anyOf).toStrictEqual([
      { enum: ["sse", "ws"] },
      { type: "string", minLength: 1 },
    ]);
  });
});

// Overriding the transport points the client at a different server. Left
// pointing at this one it would ask for a protocol the endpoint does not
// serve, and a page that never connects says nothing about why.
describe("a client transport that disagrees with the endpoint", () => {
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
   * @param {EXPECTED_OBJECT} client the `hot.client` option
   * @param {string=} transport the endpoint's transport
   * @returns {string[]} what was warned about
   */
  function inject(client, transport = "sse") {
    const instance = makeCompiler();

    compilers.push(instance);

    injectHotClient(
      [instance],
      { path: "/__webpack_hmr", transport, client },
      logger,
    );

    return warnings;
  }

  it("says so when there is no other endpoint to reach", () => {
    expect(inject({ transport: "ws" }).join("\n")).toContain(
      "will not connect",
    );
  });

  it("says nothing when the client has an endpoint of its own", () => {
    expect(
      inject({ transport: "ws", url: "wss://dev.example.com/__hmr" }),
    ).toStrictEqual([]);
  });

  it("says nothing when the two agree", () => {
    expect(inject({ transport: "sse" })).toStrictEqual([]);
  });

  it("says nothing when the client leaves the transport alone", () => {
    expect(inject({ overlay: false })).toStrictEqual([]);
  });
});

// The two ways of setting a browser option have to stay one set of names. A
// name the client acts on that the schema refuses is an option with no node
// spelling; one the schema takes that the client ignores silently does
// nothing; two names for one setting is an alias. Both sides are read from
// their own source, or this would just be a third place to forget.
describe("node and the query take the same names", () => {
  const clientSource = fs.readFileSync(
    path.join(__dirname, "..", "client-src", "index.js"),
    "utf8",
  );

  // The deprecated spellings are read by name from a list rather than written
  // out one by one, so they have to be collected from the list.
  const [, legacyList] = /** @type {RegExpMatchArray} */ (
    clientSource.match(/const LEGACY_OPTIONS = \[([\s\S]*?)\];/)
  );
  const legacy = [...legacyList.matchAll(/"([A-Za-z]+)"/g)].map(
    (found) => found[1],
  );

  /** @type {string[]} every name the client acts on from its query */
  const readByClient = [
    ...new Set([
      ...[
        .../** @type {RegExpMatchArray} */ (
          clientSource.match(/function setOverrides\([\s\S]*?\n\}/)
        )[0].matchAll(/overrides(?:\.([A-Za-z]+)|\["([^"]+)"\])/g),
      ].map((found) => found[1] || found[2]),
      ...legacy,
    ]),
  ];

  /** @type {string[]} every name `hot.client` accepts */
  const takenInNode = Object.keys(schema.definitions.HotClient.properties);

  it("reads something from the query at all", () => {
    // The extraction above is regex over source; if it ever stops matching it
    // would compare two empty lists and pass while saying nothing.
    expect(readByClient.length).toBeGreaterThan(10);
    // If the list extraction ever stops matching, the deprecated names would
    // silently drop out of the comparison.
    expect(legacy).toHaveLength(6);
  });

  // The names only the query has: `path`, which is what it called `url` first;
  // `token`, which the middleware fills in from `hot.token`; and the released
  // spellings `apply` and `connect` replaced, which an entry written by hand
  // may still carry.
  const queryOnly = ["path", "token", ...legacy];

  it("is one set of names, with nothing on one side only", () => {
    expect(
      readByClient.filter((name) => !queryOnly.includes(name)).toSorted(),
    ).toStrictEqual(takenInNode.toSorted());
    expect(
      takenInNode.filter((name) => queryOnly.includes(name)),
    ).toStrictEqual([]);
  });

  // The third place, and the one that is easiest to forget: the typedef the
  // published declarations are generated from. A name the schema takes that
  // it omits is accepted at runtime and rejected by TypeScript, which is how
  // `token` first shipped.
  it("is in the typedef the declarations come from, as well", () => {
    const hotSource = fs.readFileSync(
      path.join(__dirname, "..", "src", "hot.js"),
      "utf8",
    );
    const [typedef] = /** @type {RegExpMatchArray} */ (
      hotSource.match(/@typedef \{object\} HotClientOptions[\s\S]*?\n \*\//)
    );
    const declared = [
      // One level of nesting, since a type can be an object literal —
      // `{ retries?: number }` — and `[^}]+` would stop inside it.
      ...typedef.matchAll(/@property \{(?:[^{}]|\{[^{}]*\})+\} ([A-Za-z]+)/g),
    ].map((found) => found[1]);

    expect(declared.toSorted()).toStrictEqual(takenInNode.toSorted());
  });
});
