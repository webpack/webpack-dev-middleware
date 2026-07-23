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
 * Build a minimal Stats-like object that satisfies `toBundles`.
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

  it("publishes sync instead of built when a bundle's hash did not change", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});
    const { writes } = attachClient({ handler: hot.handle });

    compiler.emitDone(makeFakeStats({ hash: "same" }));
    writes.length = 0;

    // A rebuild that produced the same hash (e.g. another bundle of a
    // multi-compiler changed) must not be announced as `built`.
    compiler.emitInvalid();
    compiler.emitDone(makeFakeStats({ hash: "same" }));

    expect(writes.some((w) => w.includes('"action":"sync"'))).toBe(true);
    expect(writes.some((w) => w.includes('"action":"built"'))).toBe(false);

    hot.close();
  });

  it("publishes built when the bundle's hash changed", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});
    const { writes } = attachClient({ handler: hot.handle });

    compiler.emitDone(makeFakeStats({ hash: "one" }));
    writes.length = 0;

    compiler.emitInvalid();
    compiler.emitDone(makeFakeStats({ hash: "two" }));

    expect(
      writes.some(
        (w) => w.includes('"action":"built"') && w.includes('"hash":"two"'),
      ),
    ).toBe(true);

    hot.close();
  });

  it("publishes built only for the changed bundles of a multi-compiler", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});
    const { writes } = attachClient({ handler: hot.handle });

    compiler.emitDone({
      stats: [
        makeFakeStats({ name: "app", hash: "app-1" }),
        makeFakeStats({ name: "admin", hash: "admin-1" }),
      ],
    });
    writes.length = 0;

    // Only "admin" rebuilt.
    compiler.emitInvalid();
    compiler.emitDone({
      stats: [
        makeFakeStats({ name: "app", hash: "app-1" }),
        makeFakeStats({ name: "admin", hash: "admin-2" }),
      ],
    });

    expect(
      writes.some(
        (w) => w.includes('"name":"app"') && w.includes('"action":"sync"'),
      ),
    ).toBe(true);
    expect(
      writes.some(
        (w) => w.includes('"name":"admin"') && w.includes('"action":"built"'),
      ),
    ).toBe(true);
    expect(
      writes.some(
        (w) => w.includes('"name":"app"') && w.includes('"action":"built"'),
      ),
    ).toBe(false);

    hot.close();
  });

  it("does not sync new clients while a rebuild is in progress", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});

    compiler.emitDone(makeFakeStats());
    compiler.emitInvalid();

    const { writes } = attachClient({ handler: hot.handle });

    expect(writes.some((w) => w.includes('"action":"sync"'))).toBe(false);

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

  it("responds 404 instead of hanging when a client connects after close()", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});

    hot.close();

    /** @type {number | undefined} */
    let statusCode;
    let ended = false;
    const res = {
      writeHead: (code) => {
        statusCode = code;
      },
      end: () => {
        ended = true;
      },
    };

    hot.handle({}, res);

    expect(statusCode).toBe(404);
    expect(ended).toBe(true);
  });

  it("does not re-send the catch-up sync to already connected clients", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});
    const { writes: firstWrites } = attachClient({ handler: hot.handle });

    compiler.emitDone(makeFakeStats());
    firstWrites.length = 0;

    const { writes: secondWrites } = attachClient({ handler: hot.handle });

    expect(secondWrites.some((w) => w.includes('"action":"sync"'))).toBe(true);
    expect(firstWrites.some((w) => w.includes('"action":"sync"'))).toBe(false);

    hot.close();
  });

  it("pairs bundles by name when the compilation order changes", () => {
    const compiler = makeFakeCompiler();
    const hot = createHot(compiler, {});
    const { writes } = attachClient({ handler: hot.handle });

    compiler.emitDone({
      stats: [
        makeFakeStats({ name: "app", hash: "app-1" }),
        makeFakeStats({ name: "admin", hash: "admin-1" }),
      ],
    });
    writes.length = 0;

    // Same hashes, different order — nothing actually changed.
    compiler.emitInvalid();
    compiler.emitDone({
      stats: [
        makeFakeStats({ name: "admin", hash: "admin-1" }),
        makeFakeStats({ name: "app", hash: "app-1" }),
      ],
    });

    expect(writes.some((w) => w.includes('"action":"built"'))).toBe(false);
    expect(
      writes.filter((w) => w.includes('"action":"sync"')).length,
    ).toBeGreaterThanOrEqual(2);

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

  it("publishes throttled progress events when progress is enabled", () => {
    const compiler = makeFakeCompiler();
    /** @type {EXPECTED_OBJECT} */
    let progressHandler;

    compiler.webpack = {
      ProgressPlugin: class {
        /** @param {EXPECTED_OBJECT} handler handler */
        constructor(handler) {
          progressHandler = handler;
        }

        apply() {}
      },
    };

    const hot = createHot(compiler, { progress: true });
    const { writes } = attachClient({ handler: hot.handle });

    progressHandler(0.1, "building");
    // Same rounded percent — must be skipped.
    progressHandler(0.101, "building");
    progressHandler(0.5, "sealing");

    const progressWrites = writes.filter((w) =>
      w.includes('"action":"progress"'),
    );

    expect(progressWrites).toHaveLength(2);
    expect(progressWrites.some((w) => w.includes('"percent":10'))).toBe(true);
    expect(
      progressWrites.some(
        (w) => w.includes('"percent":50') && w.includes('"message":"sealing"'),
      ),
    ).toBe(true);

    hot.close();
  });

  it("resets the progress throttle when a new build starts", () => {
    const compiler = makeFakeCompiler();
    /** @type {EXPECTED_OBJECT} */
    let progressHandler;

    compiler.webpack = {
      ProgressPlugin: class {
        /** @param {EXPECTED_OBJECT} handler handler */
        constructor(handler) {
          progressHandler = handler;
        }

        apply() {}
      },
    };

    const hot = createHot(compiler, { progress: true });
    const { writes } = attachClient({ handler: hot.handle });

    progressHandler(1, "done");
    writes.length = 0;

    // A new build whose first report rounds to the same percent must still
    // be published.
    compiler.emitInvalid();
    progressHandler(1, "done");

    expect(writes.some((w) => w.includes('"action":"progress"'))).toBe(true);

    hot.close();
  });

  it("does not publish progress events after close()", () => {
    const compiler = makeFakeCompiler();
    /** @type {EXPECTED_OBJECT} */
    let progressHandler;

    compiler.webpack = {
      ProgressPlugin: class {
        /** @param {EXPECTED_OBJECT} handler handler */
        constructor(handler) {
          progressHandler = handler;
        }

        apply() {}
      },
    };

    const hot = createHot(compiler, { progress: true });
    const { writes } = attachClient({ handler: hot.handle });

    hot.close();
    writes.length = 0;
    progressHandler(0.5, "sealing");

    expect(writes).toHaveLength(0);
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
