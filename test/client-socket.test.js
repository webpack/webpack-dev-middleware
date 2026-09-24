import createSocket from "../client-src/clients/createSocket";

jest.spyOn(globalThis.console, "log").mockImplementation();

/**
 * A transport that is driven from the test rather than from a network. Every
 * instance is recorded, so a reconnection can be told apart from the first
 * connection.
 * @returns {EXPECTED_OBJECT} the constructor and what it built
 */
function createFakeClient() {
  /** @type {EXPECTED_OBJECT[]} */
  const instances = [];

  class FakeClient {
    /**
     * @param {string} url url
     * @param {EXPECTED_OBJECT=} options client options
     */
    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.closed = false;
      instances.push(this);
    }

    onOpen(fn) {
      this.openHandler = fn;
    }

    onClose(fn) {
      this.closeHandler = fn;
    }

    onMessage(fn) {
      this.messageHandler = fn;
    }

    close() {
      this.closed = true;
    }
  }

  return { FakeClient, instances };
}

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_OBJECT */

describe("createSocket", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("hands each message to every listener", () => {
    const { FakeClient, instances } = createFakeClient();
    const socket = createSocket(FakeClient, "ws://localhost/hmr");
    /** @type {string[]} */
    const first = [];
    /** @type {string[]} */
    const second = [];

    socket.addMessageListener((event) => first.push(event.data));
    socket.addMessageListener((event) => second.push(event.data));

    instances[0].messageHandler('{"action":"built"}');

    // Several entries on one page share a connection, so one message has to
    // reach all of them.
    expect(first).toEqual(['{"action":"built"}']);
    expect(second).toEqual(['{"action":"built"}']);
  });

  it("passes the url and the client options to the transport", () => {
    const { FakeClient, instances } = createFakeClient();

    createSocket(FakeClient, "http://localhost/__webpack_hmr", {
      clientOptions: { timeout: 5000 },
    });

    expect(instances[0].url).toBe("http://localhost/__webpack_hmr");
    expect(instances[0].options).toEqual({ timeout: 5000 });
  });

  it("reconnects after a drop, backing off between attempts", () => {
    const { FakeClient, instances } = createFakeClient();

    createSocket(FakeClient, "ws://localhost/hmr", {
      retryDelay: (attempt) => (attempt + 1) * 1000,
    });

    instances[0].closeHandler();
    expect(instances).toHaveLength(1);

    // Nothing before the delay is up, then exactly one new connection.
    jest.advanceTimersByTime(999);
    expect(instances).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(instances).toHaveLength(2);

    // The second attempt waits longer than the first.
    instances[1].closeHandler();
    jest.advanceTimersByTime(1999);
    expect(instances).toHaveLength(2);
    jest.advanceTimersByTime(1);
    expect(instances).toHaveLength(3);
  });

  it("starts the backoff over once a connection opens", () => {
    const { FakeClient, instances } = createFakeClient();

    createSocket(FakeClient, "ws://localhost/hmr", {
      retryDelay: (attempt) => (attempt + 1) * 1000,
    });

    instances[0].closeHandler();
    jest.advanceTimersByTime(1000);

    // A reconnection that succeeded means the next drop is a fresh outage,
    // not the continuation of the last one.
    instances[1].openHandler();
    instances[1].closeHandler();

    jest.advanceTimersByTime(1000);
    expect(instances).toHaveLength(3);
  });

  it("gives up after the configured number of retries", () => {
    const { FakeClient, instances } = createFakeClient();

    createSocket(FakeClient, "ws://localhost/hmr", {
      retries: 2,
      retryDelay: () => 1000,
    });

    for (let i = 0; i < 5; i++) {
      const last = instances[instances.length - 1];

      if (!last.closed) {
        last.closeHandler();
      }

      jest.advanceTimersByTime(1000);
    }

    // The first connection plus two retries, and no more: a server that is
    // not coming back must not fill the console forever.
    expect(instances).toHaveLength(3);
  });

  it("keeps retrying when told to", () => {
    const { FakeClient, instances } = createFakeClient();

    createSocket(FakeClient, "http://localhost/__webpack_hmr", {
      retries: Infinity,
      retryDelay: () => 1000,
    });

    for (let i = 0; i < 20; i++) {
      instances[instances.length - 1].closeHandler();
      jest.advanceTimersByTime(1000);
    }

    expect(instances).toHaveLength(21);
  });

  it("backs off exponentially by default", () => {
    const { FakeClient, instances } = createFakeClient();

    // No `retryDelay`: the default doubles each time, so a server that is
    // down does not get hammered once a second forever.
    createSocket(FakeClient, "ws://localhost/hmr");

    instances[0].closeHandler();
    jest.advanceTimersByTime(1100);
    expect(instances).toHaveLength(2);

    instances[1].closeHandler();
    // The second wait is past two seconds, which the first was not.
    jest.advanceTimersByTime(1100);
    expect(instances).toHaveLength(2);
    jest.advanceTimersByTime(1000);
    expect(instances).toHaveLength(3);
  });

  it("says it is reconnecting while the attempts are bounded", () => {
    const info = jest.spyOn(globalThis.console, "info").mockImplementation();
    const { FakeClient, instances } = createFakeClient();

    createSocket(FakeClient, "ws://localhost/hmr", {
      retries: 2,
      retryDelay: () => 1000,
    });

    instances[0].closeHandler();

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Trying to reconnect"),
    );

    info.mockRestore();
  });

  it("stays quiet when it will keep retrying forever", () => {
    const info = jest.spyOn(globalThis.console, "info").mockImplementation();
    const { FakeClient, instances } = createFakeClient();

    createSocket(FakeClient, "http://localhost/__webpack_hmr", {
      retries: Infinity,
      retryDelay: () => 1000,
    });

    for (let i = 0; i < 5; i++) {
      instances[instances.length - 1].closeHandler();
      jest.advanceTimersByTime(1000);
    }

    // Saying it every few seconds for as long as the page is open is not
    // information, it is noise — and Server-Sent Events never said it before.
    expect(info).not.toHaveBeenCalledWith(
      expect.stringContaining("Trying to reconnect"),
    );

    info.mockRestore();
  });

  it("takes an explicit choice about announcing retries", () => {
    const info = jest.spyOn(globalThis.console, "info").mockImplementation();
    const { FakeClient, instances } = createFakeClient();

    // Bounded attempts would announce themselves, but the caller said not to.
    createSocket(FakeClient, "ws://localhost/hmr", {
      logRetries: false,
      retries: 2,
      retryDelay: () => 1000,
    });

    instances[0].closeHandler();

    expect(info).not.toHaveBeenCalledWith(
      expect.stringContaining("Trying to reconnect"),
    );

    info.mockRestore();
  });

  it("closes cleanly while waiting to reconnect", () => {
    const { FakeClient, instances } = createFakeClient();
    const socket = createSocket(FakeClient, "ws://localhost/hmr", {
      retryDelay: () => 1000,
    });

    // Closed with no live connection, only a pending timer — there is nothing
    // to close, and the timer must not fire afterwards.
    instances[0].closeHandler();
    socket.close();
    jest.advanceTimersByTime(10000);

    expect(instances).toHaveLength(1);
  });

  it("stops reconnecting once closed", () => {
    const { FakeClient, instances } = createFakeClient();
    const socket = createSocket(FakeClient, "ws://localhost/hmr", {
      retryDelay: () => 1000,
    });

    socket.close();

    expect(instances[0].closed).toBe(true);

    // A close the transport had already queued must not schedule a
    // reconnection after the caller asked for none.
    instances[0].closeHandler();
    jest.advanceTimersByTime(10000);

    expect(instances).toHaveLength(1);
  });
});
