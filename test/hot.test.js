import createHot, {
  createEventStream,
  formatErrors,
  pathMatch,
} from "../src/hot";

jest.spyOn(globalThis.console, "log").mockImplementation();

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_OBJECT */

/** @type {EXPECTED_OBJECT} */
const noopLogger = { log() {} };

/**
 * Build a minimal compiler-like object so we can drive `invalid`/`done` from
 * the test without spinning up webpack.
 * @param {EXPECTED_OBJECT=} logger logger returned by getInfrastructureLogger
 * @returns {{ hooks: EXPECTED_OBJECT, emitInvalid: () => void, emitDone: (stats: EXPECTED_OBJECT) => void }} fake compiler
 */
function makeFakeCompiler(logger = noopLogger) {
  const invalidTaps = [];
  const doneTaps = [];
  return {
    hooks: {
      invalid: { tap: (_name, fn) => invalidTaps.push(fn) },
      done: { tap: (_name, fn) => doneTaps.push(fn) },
    },
    getInfrastructureLogger: () => logger,
    emitInvalid(fileName) {
      for (const fn of invalidTaps) fn(fileName);
    },
    emitDone(stats) {
      for (const fn of doneTaps) fn(stats);
    },
  };
}

/**
 * Build a minimal Stats-like object that satisfies `publishStats`.
 * @param {EXPECTED_OBJECT=} overrides field overrides applied on top of the defaults
 * @returns {EXPECTED_OBJECT} fake stats
 */
function makeFakeStats(overrides = {}) {
  return {
    toJson() {
      return {
        time: 5,
        hash: "abc",
        warnings: [],
        errors: [],
        modules: [],
        ...overrides,
      };
    },
    compilation: undefined,
  };
}

/**
 * Attach a fake response to the given event stream and collect every chunk
 * written to it.
 * @param {EXPECTED_OBJECT} eventStream stream returned by createEventStream or hot instance
 * @param {{ httpVersion?: string }=} reqOverrides overrides for the fake req
 * @returns {{ res: EXPECTED_OBJECT, writes: string[], headers: EXPECTED_OBJECT }} captured state
 */
function attachClient(eventStream, reqOverrides = {}) {
  const writes = [];
  /** @type {EXPECTED_OBJECT | undefined} */
  let headers;
  const res = {
    writableEnded: false,
    write: (chunk) => {
      writes.push(chunk);
    },
    writeHead: (_code, h) => {
      headers = h;
    },
    end: () => {
      res.writableEnded = true;
    },
  };
  const req = {
    httpVersion: "1.1",
    socket: { setKeepAlive: () => {} },
    on: () => {},
    ...reqOverrides,
  };
  eventStream.handler(req, res);
  return { res, writes, headers };
}

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

    it("returns false when the path has a trailing segment", () => {
      expect(pathMatch("/__webpack_hmr/extra", "/__webpack_hmr")).toBe(false);
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

  describe("createEventStream", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("emits a heartbeat at the configured interval", () => {
      const stream = createEventStream(1000, noopLogger);
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
      const stream = createEventStream(5000, noopLogger);
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
      const stream = createEventStream(5000, noopLogger);
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

    it("sets Connection: keep-alive for HTTP/1 clients", () => {
      const stream = createEventStream(5000, noopLogger);
      const { headers } = attachClient(stream, { httpVersion: "1.1" });
      expect(headers.Connection).toBe("keep-alive");
      stream.close();
    });

    it("does not set Connection: keep-alive for HTTP/2 clients", () => {
      const stream = createEventStream(5000, noopLogger);
      const { headers } = attachClient(stream, { httpVersion: "2.0" });
      expect(headers.Connection).toBeUndefined();
      stream.close();
    });

    it("broadcasts events to every attached client", () => {
      const stream = createEventStream(5000, noopLogger);
      const clients = [
        attachClient(stream),
        attachClient(stream),
        attachClient(stream),
      ];

      for (const c of clients) c.writes.length = 0;

      stream.publish({ action: "built", hash: "xyz" });

      for (const c of clients) {
        expect(c.writes.some((w) => w.includes('"hash":"xyz"'))).toBe(true);
      }

      stream.close();
    });

    it("logs client connect and disconnect with the active count", () => {
      const messages = [];
      const stream = createEventStream(5000, {
        log: (message) => messages.push(message),
      });
      /** @type {() => void} */
      let closeHandler = () => {};
      const fakeReq = {
        httpVersion: "1.1",
        socket: { setKeepAlive: () => {} },
        on: (event, fn) => {
          if (event === "close") closeHandler = fn;
        },
      };
      const fakeRes = {
        writableEnded: false,
        write: () => {},
        writeHead: () => {},
        end: () => {},
      };

      stream.handler(fakeReq, fakeRes);
      expect(messages).toContain("Client connected (1 active)");

      closeHandler();
      expect(messages).toContain("Client disconnected (0 active)");

      stream.close();
    });
  });
});

describe("createHot", () => {
  it("logs that HMR is enabled with the served path", () => {
    const messages = [];
    const compiler = makeFakeCompiler({
      log: (message) => messages.push(message),
    });

    const hot = createHot(compiler, { path: "/__hmr" });

    expect(messages).toContain(
      'Hot module replacement enabled, serving events at "/__hmr"',
    );

    hot.close();
  });

  it("exposes publish() so callers can broadcast custom payloads", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});
    const { writes } = attachClient({ handler: hot.handle });

    hot.publish({ action: "custom-thing", payload: 42 });

    expect(
      writes.some(
        (w) =>
          w.includes('"action":"custom-thing"') && w.includes('"payload":42'),
      ),
    ).toBe(true);

    hot.close();
  });

  it("includes the changed file in the building payload", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});
    const { writes } = attachClient({ handler: hot.handle });

    compiler.emitInvalid("/src/index.js");

    expect(
      writes.some(
        (w) =>
          w.includes('"action":"building"') &&
          w.includes('"file":"/src/index.js"'),
      ),
    ).toBe(true);

    hot.close();
  });

  it("omits the file field when the invalid hook reports none", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});
    const { writes } = attachClient({ handler: hot.handle });

    compiler.emitInvalid();

    const building = writes.find((w) => w.includes('"action":"building"'));
    expect(building).toBeDefined();
    expect(building).not.toContain('"file"');

    hot.close();
  });

  it("sends a sync payload to a client that connects after a build", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});

    // A build finishes BEFORE anyone connects.
    compiler.emitDone(makeFakeStats());

    const { writes } = attachClient({ handler: hot.handle });

    expect(writes.some((w) => w.includes('"action":"sync"'))).toBe(true);

    hot.close();
  });

  it("falls back to compilation.name when stats name is empty", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});
    const { writes } = attachClient({ handler: hot.handle });

    compiler.emitDone({
      toJson() {
        return {
          time: 1,
          hash: "h",
          warnings: [],
          errors: [],
          modules: [],
          // no `name` here
        };
      },
      compilation: { name: "child-bundle" },
    });

    expect(
      writes.some(
        (w) =>
          w.includes('"name":"child-bundle"') && w.includes('"action":"built"'),
      ),
    ).toBe(true);

    hot.close();
  });

  it("forwards custom statsOptions to stats.toJson", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {
      statsOptions: { modules: true, ids: true },
    });
    attachClient({ handler: hot.handle });

    /** @type {EXPECTED_OBJECT} */
    let receivedOptions;

    compiler.emitDone({
      toJson(statsOptions) {
        receivedOptions = statsOptions;
        return {
          time: 1,
          hash: "h",
          warnings: [],
          errors: [],
          modules: [],
        };
      },
      compilation: undefined,
    });

    expect(receivedOptions).toMatchObject({ modules: true, ids: true });

    hot.close();
  });

  it("stops publishing after close() even if the compiler still emits", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});
    const { writes } = attachClient({ handler: hot.handle });

    hot.close();
    writes.length = 0;

    // After close, the tap callbacks remain registered (tapable does not
    // support removal), but they must noop instead of writing to clients.
    compiler.emitInvalid();
    compiler.emitDone(makeFakeStats());

    expect(writes).toHaveLength(0);
  });
});
