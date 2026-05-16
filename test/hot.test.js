import {
  buildModuleMap,
  createEventStream,
  formatErrors,
  pathMatch,
} from "../src/hot";

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
