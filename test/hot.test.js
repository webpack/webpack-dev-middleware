import express from "express";
import request from "supertest";

import middleware from "../src";
import {
  HOT_DEFAULT_HEARTBEAT,
  HOT_DEFAULT_PATH,
  buildModuleMap,
  createEventStream,
  formatErrors,
  pathMatch,
} from "../src/hot";

import webpackArrayConfig from "./fixtures/webpack.array.config";
import webpackConfig from "./fixtures/webpack.config";
import getCompiler from "./helpers/getCompiler";

jest.spyOn(globalThis.console, "log").mockImplementation();

describe("hot middleware (unit)", () => {
  describe("pathMatch", () => {
    it("matches exact pathname", () => {
      expect(pathMatch("/__webpack_hmr", "/__webpack_hmr")).toBe(true);
    });

    it("strips query string", () => {
      expect(pathMatch("/__webpack_hmr?name=app", "/__webpack_hmr")).toBe(true);
    });

    it("returns false on mismatch", () => {
      expect(pathMatch("/bundle.js", "/__webpack_hmr")).toBe(false);
    });

    it("returns false when url is undefined", () => {
      expect(pathMatch(undefined, "/__webpack_hmr")).toBe(false);
    });

    it("returns false on malformed urls without throwing", () => {
      expect(pathMatch("http://[bad", "/__webpack_hmr")).toBe(false);
    });
  });

  describe("formatErrors", () => {
    it("returns an empty array when input is empty", () => {
      expect(formatErrors([])).toEqual([]);
    });

    it("passes through string errors unchanged", () => {
      expect(formatErrors(["boom"])).toEqual(["boom"]);
    });

    it("formats webpack 5 error objects", () => {
      expect(
        formatErrors([{ moduleName: "./foo.js", loc: "1:1", message: "boom" }]),
      ).toEqual(["./foo.js 1:1\nboom"]);
    });

    it("tolerates missing moduleName and loc", () => {
      expect(formatErrors([{ message: "boom" }])).toEqual([" \nboom"]);
    });
  });

  describe("buildModuleMap", () => {
    it("maps id to name", () => {
      expect(
        buildModuleMap([
          { id: 1, name: "./a.js" },
          { id: 2, name: "./b.js" },
        ]),
      ).toEqual({ 1: "./a.js", 2: "./b.js" });
    });
  });

  describe("createEventStream", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("emits a heartbeat at the configured interval", () => {
      const stream = createEventStream(1000);
      const writes = [];
      const fakeRes = {
        writableEnded: false,
        write: (chunk) => writes.push(chunk),
        writeHead: () => {},
        end: () => {},
      };
      const fakeReq = {
        httpVersion: "1.1",
        socket: { setKeepAlive: () => {} },
        on: () => {},
      };

      stream.handler(fakeReq, fakeRes);
      writes.length = 0;
      jest.advanceTimersByTime(1000);

      expect(writes.some((w) => w.includes("💓"))).toBe(true);

      stream.close();
    });

    it("publishes JSON payloads to attached clients", () => {
      const stream = createEventStream(5000);
      const writes = [];
      const fakeRes = {
        writableEnded: false,
        write: (chunk) => writes.push(chunk),
        writeHead: () => {},
        end: () => {},
      };
      const fakeReq = {
        httpVersion: "1.1",
        socket: { setKeepAlive: () => {} },
        on: () => {},
      };

      stream.handler(fakeReq, fakeRes);
      stream.publish({ action: "built", hash: "abc" });

      expect(writes.some((w) => w.includes('"action":"built"'))).toBe(true);
      expect(writes.some((w) => w.includes('"hash":"abc"'))).toBe(true);

      stream.close();
    });

    it("close ends connected clients", () => {
      const stream = createEventStream(5000);
      let ended = false;
      const fakeRes = {
        writableEnded: false,
        write: () => {},
        writeHead: () => {},
        end: () => {
          ended = true;
        },
      };
      const fakeReq = {
        httpVersion: "1.1",
        socket: { setKeepAlive: () => {} },
        on: () => {},
      };

      stream.handler(fakeReq, fakeRes);
      stream.close();

      expect(ended).toBe(true);
    });
  });
});

describe("hot middleware (integration)", () => {
  /**
   * @param {object=} hotOptions hot options
   * @param {object=} extra additional middleware options
   * @param {object=} config webpack config used to create the compiler
   * @returns {Promise<{ app: import("express").Express, instance: ReturnType<typeof middleware> }>} app and middleware instance
   */
  async function setup(hotOptions = true, extra = {}, config = webpackConfig) {
    const compiler = getCompiler(config);
    const instance = middleware(compiler, { hot: hotOptions, ...extra });
    const app = express();
    app.use(instance);

    await new Promise((resolve, reject) => {
      instance.waitUntilValid((stats) =>
        stats && stats.hasErrors() ? reject(stats.toString()) : resolve(),
      );
    });

    return { app, instance };
  }

  it("exposes default constants", () => {
    expect(HOT_DEFAULT_PATH).toBe("/__webpack_hmr");
    expect(HOT_DEFAULT_HEARTBEAT).toBe(10 * 1000);
  });

  it("serves SSE on the default path with correct headers", async () => {
    const { app, instance } = await setup(true);

    try {
      await new Promise((resolve, reject) => {
        request(app)
          .get(HOT_DEFAULT_PATH)
          .buffer(false)
          .parse((res, cb) => {
            res.headers["content-type"] ||= "";
            // Detach as soon as we got the headers.
            res.on("data", () => {});
            res.on("end", () => cb(null, ""));
            // Force-close after a short window to terminate the SSE stream.
            setTimeout(() => res.destroy(), 50);
          })
          .end((err, res) => {
            if (err && err.code !== "ECONNRESET") return reject(err);
            try {
              expect(res.status).toBe(200);
              expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
              expect(res.headers["cache-control"]).toBe(
                "no-cache, no-transform",
              );
              expect(res.headers["x-accel-buffering"]).toBe("no");
              resolve();
            } catch (err_) {
              reject(err_);
            }
          });
      });
    } finally {
      await new Promise((resolve) => {
        instance.close(resolve);
      });
    }
  });

  it("respects a custom path", async () => {
    const { app, instance } = await setup({ path: "/__custom_hmr" });

    try {
      // Custom path responds as SSE.
      await new Promise((resolve, reject) => {
        request(app)
          .get("/__custom_hmr")
          .buffer(false)
          .parse((res, cb) => {
            res.on("data", () => {});
            res.on("end", () => cb(null, ""));
            setTimeout(() => res.destroy(), 50);
          })
          .end((err, res) => {
            if (err && err.code !== "ECONNRESET") return reject(err);
            try {
              expect(res.status).toBe(200);
              expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
              resolve();
            } catch (err_) {
              reject(err_);
            }
          });
      });

      // Default path is no longer hooked.
      const res = await request(app).get(HOT_DEFAULT_PATH);
      expect(res.headers["content-type"] || "").not.toMatch(/event-stream/);
    } finally {
      await new Promise((resolve) => {
        instance.close(resolve);
      });
    }
  });

  it("does not intercept non-hot URLs", async () => {
    const { app, instance } = await setup(true);

    try {
      const res = await request(app).get("/bundle.js");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"] || "").not.toMatch(/event-stream/);
    } finally {
      await new Promise((resolve) => {
        instance.close(resolve);
      });
    }
  });

  it("works with MultiCompiler", async () => {
    const { app, instance } = await setup(true, {}, webpackArrayConfig);

    try {
      await new Promise((resolve, reject) => {
        request(app)
          .get(HOT_DEFAULT_PATH)
          .buffer(false)
          .parse((res, cb) => {
            res.on("data", () => {});
            res.on("end", () => cb(null, ""));
            setTimeout(() => res.destroy(), 50);
          })
          .end((err, res) => {
            if (err && err.code !== "ECONNRESET") return reject(err);
            try {
              expect(res.status).toBe(200);
              expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
              resolve();
            } catch (err_) {
              reject(err_);
            }
          });
      });
    } finally {
      await new Promise((resolve) => {
        instance.close(resolve);
      });
    }
  });

  it("close() tears down hot connections", async () => {
    const { instance } = await setup(true);

    // Closing must not throw nor leave open intervals.
    await new Promise((resolve) => {
      instance.close(resolve);
    });

    expect(() =>
      instance.context.hot.publish({ action: "noop" }),
    ).not.toThrow();
  });

  it("calls a custom log function on build events", async () => {
    const messages = [];
    const { instance } = await setup({
      log: (msg) => messages.push(msg),
    });

    try {
      // Force an invalid + done cycle.
      await new Promise((resolve) => {
        instance.invalidate(() => resolve());
      });

      expect(messages.some((m) => m.startsWith("webpack built"))).toBe(true);
    } finally {
      await new Promise((resolve) => {
        instance.close(resolve);
      });
    }
  });

  it("respects log: false (no console output from hot)", async () => {
    const spy = jest
      .spyOn(globalThis.console, "log")
      .mockImplementation(() => {});

    const { instance } = await setup({ log: false });

    try {
      await new Promise((resolve) => {
        instance.invalidate(() => resolve());
      });

      const fromHot = spy.mock.calls.filter(
        ([msg]) =>
          typeof msg === "string" &&
          (msg.startsWith("webpack built") || msg === "webpack building..."),
      );
      expect(fromHot).toHaveLength(0);
    } finally {
      await new Promise((resolve) => {
        instance.close(resolve);
      });
      spy.mockRestore();
    }
  });
});
