import path from "node:path";

import { Volume, createFsFromVolume } from "memfs";

import middleware from "../src";

import getCompiler from "./helpers/getCompiler";

// Suppress unnecessary stats output
jest.spyOn(globalThis.console, "log").mockImplementation();

const configuredFs = createFsFromVolume(new Volume());

configuredFs.join = path.join.bind(path);

describe("validation", () => {
  const cases = {
    mimeTypes: {
      success: [{ phtml: ["text/html"] }],
      failure: ["foo"],
    },
    writeToDisk: {
      success: [true, false, () => {}],
      failure: [{}],
    },
    methods: {
      success: [["GET", "HEAD"]],
      failure: [{}, true],
    },
    headers: {
      success: [
        { "X-Custom-Header": "yes" },
        () => {},
        [{ key: "foo", value: "bar" }],
      ],
      failure: [true, 1, [], [{ foo: "bar" }]],
    },
    publicPath: {
      success: ["/foo", "", "auto", () => "/public/path"],
      failure: [false],
    },
    serverSideRender: {
      success: [true],
      failure: ["foo", 0],
    },
    outputFileSystem: {
      success: [configuredFs],
      failure: [false],
    },
    index: {
      success: [true, false, "foo"],
      failure: [0, {}],
    },
    stats: {
      success: [true, false, "normal", "verbose", { all: false, assets: true }],
      failure: [0],
    },
    mimeTypeDefault: {
      success: ["text/plain"],
      failure: [0],
    },
    modifyResponseData: {
      success: [(_ignore, _ignore1, foo, bar) => ({ foo, bar })],
      failure: [true],
    },
    etag: {
      success: ["weak", "strong"],
      failure: ["foo", 0],
    },
    lastModified: {
      success: [true, false],
      failure: ["foo", 0],
    },
    cacheControl: {
      success: [
        true,
        false,
        10000,
        "max-age=100",
        { immutable: true, maxAge: 10000 },
      ],
      failure: [{ unknown: true, maxAge: 10000 }],
    },
    cacheImmutable: {
      success: [true, false],
      failure: ["foo", 0],
    },
  };

  // eslint-disable-next-line jsdoc/reject-any-type
  /** @typedef {any} EXPECTED_ANY */

  /**
   * @param {EXPECTED_ANY} value value
   * @returns {string} stringified value
   */
  function stringifyValue(value) {
    if (
      Array.isArray(value) ||
      (value && typeof value === "object" && value.constructor === Object)
    ) {
      return JSON.stringify(value);
    }

    return value;
  }

  /**
   * @param {string} key key
   * @param {EXPECTED_ANY} value value
   * @param {"success" | "failure"} type type
   */
  function createTestCase(key, value, type) {
    it(`should ${
      type === "success" ? "successfully validate" : "throw an error on"
    } the "${key}" option with "${stringifyValue(value)}" value`, (done) => {
      const compiler = getCompiler();

      let webpackDevMiddleware;
      let error;

      try {
        webpackDevMiddleware = middleware(compiler, { [key]: value });
      } catch (err) {
        if (err.name !== "ValidationError") {
          throw err;
        }

        error = err;
      } finally {
        if (type === "success") {
          expect(error).toBeUndefined();
        } else if (type === "failure") {
          expect(() => {
            throw error;
          }).toThrowErrorMatchingSnapshot();
        }

        if (webpackDevMiddleware) {
          webpackDevMiddleware.waitUntilValid(() => {
            webpackDevMiddleware.close(() => {
              done();
            });
          });
        } else {
          done();
        }
      }
    });
  }

  for (const [key, values] of Object.entries(cases)) {
    for (const type of Object.keys(values)) {
      for (const value of values[type]) {
        createTestCase(key, value, type);
      }
    }
  }
});
