import express from "express";
import request from "supertest";

import middleware from "../src";

import webpackConfig from "./fixtures/webpack.config";
import getCompiler from "./helpers/getCompiler";

jest.spyOn(globalThis.console, "log").mockImplementation();

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

// `cache` and `mime` replaced six flat options. Both spellings work until the
// next major, so what matters is that one shape reaches the middleware however
// it was written, and that the legacy one says so.
describe("the cache and mime option groups", () => {
  /** @type {EXPECTED_ANY[]} */
  let instances = [];
  /** @type {string[]} */
  let warnings = [];

  beforeEach(() => {
    warnings = [];
  });

  afterEach((done) => {
    const closing = instances;

    instances = [];

    Promise.all(
      closing.map(
        (instance) =>
          new Promise((resolve) => {
            instance.close(resolve);
          }),
      ),
    ).then(() => done());
  });

  /**
   * Plugin mode, so nothing starts watching.
   * @param {EXPECTED_ANY} options middleware options
   * @returns {EXPECTED_ANY} the middleware instance
   */
  function build(options) {
    const compiler = getCompiler(webpackConfig);
    const real = compiler.getInfrastructureLogger;

    compiler.getInfrastructureLogger = (name) => {
      const logger = real.call(compiler, name);

      return Object.assign(Object.create(logger), {
        warn: (/** @type {string} */ message) => warnings.push(message),
      });
    };

    const instance = middleware(compiler, options, true);

    instances.push(instance);

    return instance;
  }

  describe("the grouped spelling", () => {
    it("is what the middleware reads", () => {
      const { options } = build({
        cache: {
          etag: "strong",
          lastModified: true,
          control: "max-age=0",
          immutable: true,
        },
        mime: { types: { mycustom: "text/x-custom" }, default: "text/plain" },
      }).context;

      expect(options.cache).toStrictEqual({
        etag: "strong",
        lastModified: true,
        control: "max-age=0",
        immutable: true,
      });
      expect(options.mime).toStrictEqual({
        types: { mycustom: "text/x-custom" },
        default: "text/plain",
      });
    });

    it("says nothing about deprecation", () => {
      build({ cache: { etag: "weak" }, mime: { default: "text/plain" } });

      expect(warnings).toStrictEqual([]);
    });

    // `control` can be an object, which every response reads — so the
    // middleware holds a copy, as it does of everything else it was given.
    it("is not changed by a caller changing their own `cache.control`", () => {
      const control = { maxAge: 100 };
      const instance = build({ cache: { control } });

      control.maxAge = 999;

      expect(instance.context.options.cache.control).toStrictEqual({
        maxAge: 100,
      });
    });

    // What is normalized has to be what a response reads, not only what a test
    // of the normalized options can see.
    it("is what a response is sent with", async () => {
      const compiler = getCompiler({
        ...webpackConfig,
        output: { ...webpackConfig.output, filename: "bundle.unknown" },
      });
      const instance = middleware(compiler, {
        cache: { control: "max-age=123456" },
        mime: { default: "text/x-grouped" },
      });

      instances.push(instance);

      const app = express();

      app.use(instance);

      await new Promise((resolve) => {
        instance.waitUntilValid(resolve);
      });

      const response = await request(app).get("/bundle.unknown");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("max-age=123456");
      expect(response.headers["content-type"]).toContain("text/x-grouped");
    });

    it("registers its media types on the instance's own table", () => {
      const { mimeTypes } = build({
        mime: { types: { mycustom: "text/x-custom" } },
      }).context;

      expect(mimeTypes.lookup("mycustom")).toBe("text/x-custom");
    });
  });

  describe("the legacy spelling", () => {
    it.each([
      ["etag", "strong", "cache", "etag"],
      ["lastModified", true, "cache", "lastModified"],
      ["cacheControl", "max-age=0", "cache", "control"],
      ["cacheImmutable", true, "cache", "immutable"],
      ["mimeTypes", { mycustom: "text/x-custom" }, "mime", "types"],
      ["mimeTypeDefault", "text/plain", "mime", "default"],
    ])("folds $0 into $2.$3", (legacy, value, group, key) => {
      const { options } = build({ [legacy]: value }).context;

      expect(options[group][key]).toStrictEqual(value);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain(`The '${legacy}' option is deprecated`);
      expect(warnings[0]).toContain(`Use '${group}.${key}' instead`);
    });

    it("is left on the options object, for anything still reading it", () => {
      // `instance.context.options` is reachable, so folding a name in must not
      // take it away.
      const { options } = build({ etag: "weak" }).context;

      expect(options.etag).toBe("weak");
      expect(options.cache.etag).toBe("weak");
    });
  });

  describe("both spellings at once", () => {
    it("applies the grouped one", () => {
      // The other way round, a migration that sets the new name and forgets to
      // delete the old would silently not apply.
      const { options } = build({
        etag: "weak",
        cache: { etag: "strong" },
      }).context;

      expect(options.cache.etag).toBe("strong");
    });

    it("says which one is winning", () => {
      build({ etag: "weak", cache: { etag: "strong" } });

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("'cache.etag' is set as well");
      expect(warnings[0]).toContain("Remove 'etag'");
    });
  });

  // Folding happens into a copy rather than into the object it was given. Two
  // middlewares built from one options object would otherwise reach each other
  // through it: the first would leave `cache` populated, and the second would
  // report the legacy name as a conflict with a group the caller never set.
  it("does not fold into the object it was given", () => {
    const shared = { etag: "weak" };

    const first = build(shared);

    expect(shared.cache).toBeUndefined();
    expect(first.context.options.cache.etag).toBe("weak");

    warnings = [];

    const second = build(shared);

    expect(second.context.options.cache.etag).toBe("weak");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("The 'etag' option is deprecated");
  });

  it("leaves both groups as objects when neither was given", () => {
    // Everything below the entry point reads `options.cache.x` directly, so an
    // absent group would be a crash rather than a default.
    const { options } = build({}).context;

    expect(options.cache).toStrictEqual({});
    expect(options.mime).toStrictEqual({});
  });
});
