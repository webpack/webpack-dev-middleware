import EventSourceClient from "../client-src/clients/EventSourceClient";
import WebSocketClient from "../client-src/clients/WebSocketClient";

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_OBJECT */

/**
 * Stand in for the browser's `EventSource`, driven from the test.
 * @returns {EXPECTED_OBJECT} the constructor and what it built
 */
function fakeEventSource() {
  /** @type {EXPECTED_OBJECT[]} */
  const instances = [];

  globalThis.window = /** @type {EXPECTED_OBJECT} */ ({
    EventSource: function EventSource(url) {
      /** @type {EXPECTED_OBJECT} */
      const source = {
        url,
        closed: false,
        listeners: {},
        addEventListener(type, fn) {
          source.listeners[type] = fn;
        },
        close() {
          source.closed = true;
        },
        emit(type, event) {
          if (source.listeners[type]) {
            source.listeners[type](event);
          }
        },
      };

      instances.push(source);

      return source;
    },
  });

  return instances;
}

/**
 * Stand in for the browser's `WebSocket`, plus the anchor the url resolver uses.
 * @returns {EXPECTED_OBJECT} the sockets built
 */
function fakeWebSocket() {
  /** @type {EXPECTED_OBJECT[]} */
  const instances = [];

  globalThis.document = /** @type {EXPECTED_OBJECT} */ ({
    createElement: () => {
      /** @type {EXPECTED_OBJECT} */
      const anchor = {};

      Object.defineProperty(anchor, "href", {
        get: () => anchor.resolved,
        set: (value) => {
          anchor.resolved = /^[a-z]+:\/\//i.test(value)
            ? value
            : `https://example.test${value}`;
        },
      });

      return anchor;
    },
  });

  globalThis.WebSocket = /** @type {EXPECTED_OBJECT} */ (
    function WebSocket(url) {
      /** @type {EXPECTED_OBJECT} */
      const socket = this;

      socket.url = url;
      socket.closed = false;
      socket.close = () => {
        socket.closed = true;
      };

      instances.push(socket);
    }
  );

  return instances;
}

/**
 * The two transports answer the same calls, so the cases below are written
 * once and run against each. `emit` is how the test plays the browser.
 */
const transports = [
  {
    name: "EventSourceClient",
    Client: EventSourceClient,
    setup: fakeEventSource,
    teardown: () => {
      delete globalThis.window;
    },
    // `EventSource` has no `close` event — a dropped connection is an `error`,
    // which is exactly the difference this shared contract hides.
    emit: (instance, type, event) =>
      instance.emit(type === "close" ? "error" : type, event),
  },
  {
    name: "WebSocketClient",
    Client: WebSocketClient,
    setup: fakeWebSocket,
    teardown: () => {
      delete globalThis.document;
      delete globalThis.WebSocket;
    },
    emit: (instance, type, event) => {
      const handler = {
        open: "onopen",
        close: "onclose",
        message: "onmessage",
      };

      if (instance[handler[type]]) {
        instance[handler[type]](event);
      }
    },
  },
];

for (const { name, Client, setup, teardown, emit } of transports) {
  describe(`${name} (the transport contract)`, () => {
    /** @type {EXPECTED_OBJECT[]} */
    let instances;

    beforeEach(() => {
      // `EventSourceClient` arms a watchdog in its constructor, and the cases
      // below that never close their client would otherwise leave a real
      // interval ticking after the file is done.
      jest.useFakeTimers();
      instances = setup();
    });

    afterEach(() => {
      teardown();
      jest.useRealTimers();
    });

    it("reports the connection opening", () => {
      const client = new Client("/__webpack_hmr");
      const opened = jest.fn();

      client.onOpen(opened);
      emit(instances[0], "open", {});

      expect(opened).toHaveBeenCalledTimes(1);
    });

    it("reports the connection closing", () => {
      const client = new Client("/__webpack_hmr");
      const closed = jest.fn();

      client.onClose(closed);
      emit(instances[0], "close", {});

      expect(closed).toHaveBeenCalledTimes(1);
    });

    it("hands the message on as a string", () => {
      const client = new Client("/__webpack_hmr");
      const received = jest.fn();

      client.onMessage(received);
      emit(instances[0], "message", { data: '{"action":"built"}' });

      expect(received).toHaveBeenCalledWith('{"action":"built"}');
    });

    it("tolerates an event arriving before anything is listening", () => {
      const client = new Client("/__webpack_hmr");

      // The caller registers its handlers after constructing, so an event in
      // between must not throw.
      expect(client).toBeDefined();
      expect(() => {
        emit(instances[0], "open", {});
        emit(instances[0], "message", { data: "{}" });
        emit(instances[0], "close", {});
      }).not.toThrow();
    });

    it("closes the underlying connection", () => {
      const client = new Client("/__webpack_hmr");

      client.close();

      expect(instances[0].closed).toBe(true);
    });

    it("says nothing after being closed", () => {
      const client = new Client("/__webpack_hmr");
      const closed = jest.fn();
      const received = jest.fn();

      client.onClose(closed);
      client.onMessage(received);
      client.close();

      // Whatever the browser had already queued must not reach the caller
      // after it asked for none — or the shared socket reconnects a
      // connection nobody wants.
      emit(instances[0], "close", {});
      emit(instances[0], "message", { data: "{}" });

      expect(closed).not.toHaveBeenCalled();
      expect(received).not.toHaveBeenCalled();
    });
  });
}

describe("EventSourceClient (what only it does)", () => {
  /**
   * @param {EXPECTED_OBJECT} instance fake source
   * @param {string} type event type
   * @param {EXPECTED_OBJECT} event event
   */
  function emit(instance, type, event) {
    instance.emit(type, event);
  }

  /** @type {EXPECTED_OBJECT[]} */
  let instances;

  beforeEach(() => {
    jest.useFakeTimers();
    instances = fakeEventSource();
  });

  afterEach(() => {
    delete globalThis.window;
    jest.useRealTimers();
  });

  it("reports a close when the connection falls silent", () => {
    const client = new EventSourceClient("/__webpack_hmr", { timeout: 1000 });
    const closed = jest.fn();

    client.onClose(closed);

    // A connection can die without the browser firing `error` at all, so
    // silence past the timeout is the only thing that notices. The watchdog
    // ticks twice per timeout, so the first tick past it is at 1500ms.
    jest.advanceTimersByTime(1500);

    expect(closed).toHaveBeenCalledTimes(1);
    expect(instances[0].closed).toBe(true);
  });

  it("keeps the connection while messages keep arriving", () => {
    const client = new EventSourceClient("/__webpack_hmr", { timeout: 1000 });
    const closed = jest.fn();

    client.onClose(closed);

    for (let i = 0; i < 4; i++) {
      jest.advanceTimersByTime(600);
      emit(instances[0], "message", { data: "💓" });
    }

    expect(closed).not.toHaveBeenCalled();
  });

  it("reports a close once, however it was noticed", () => {
    const client = new EventSourceClient("/__webpack_hmr", { timeout: 1000 });
    const closed = jest.fn();

    client.onClose(closed);
    instances[0].emit("error", {});
    // The watchdog is still armed when the error arrives; both must not
    // report, or the shared socket schedules two reconnections.
    jest.advanceTimersByTime(5000);
    instances[0].emit("error", {});

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("stops the watchdog when closed", () => {
    const client = new EventSourceClient("/__webpack_hmr", { timeout: 1000 });
    const closed = jest.fn();

    client.onClose(closed);
    client.close();
    jest.advanceTimersByTime(60000);

    expect(closed).not.toHaveBeenCalled();
  });

  it("ignores an open that arrives after it was closed", () => {
    const client = new EventSourceClient("/__webpack_hmr", { timeout: 1000 });
    const opened = jest.fn();

    client.onOpen(opened);
    client.close();

    // A connection that completed its handshake as the caller closed it would
    // otherwise look open, and reset the watchdog on a dead source.
    instances[0].emit("open", {});

    expect(opened).not.toHaveBeenCalled();
  });

  it("falls back to a default timeout", () => {
    const client = new EventSourceClient("/__webpack_hmr");

    expect(client.timeout).toBe(20000);
  });
});
