import fs from "node:fs";
import path from "node:path";

import socketOptions from "../client-src/utils/socket-options";

/**
 * `createSocket`'s own default, read from its source: the WebSocket half of
 * `retries` is "whatever `createSocket` does with nothing", so the number in
 * the docs depends on it.
 * @returns {number} the default it falls back to
 */
function createSocketDefaultRetries() {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "client-src", "clients", "createSocket.js"),
    "utf8",
  );
  const [, value] = /** @type {RegExpMatchArray} */ (
    source.match(/options\.retries === undefined \? (\d+)/)
  );

  return Number(value);
}

// `reconnect` and `timeout` mean different things to the two transports, and
// before this each was silently inert on one of them: `reconnect` was ignored
// over Server-Sent Events, which always retried forever, and `timeout` was
// handed to a WebSocket client whose constructor takes no options at all.
describe("what each transport makes of reconnect and timeout", () => {
  describe("Server-Sent Events", () => {
    it("keeps trying for as long as the page is open, by default", () => {
      // A dev server is expected to come back, and a tab left open across a
      // restart has to find it again.
      expect(socketOptions({ connect: { timeout: 20_000 } }).retries).toBe(
        Infinity,
      );
    });

    it("honours a bounded number of attempts when one was asked for", () => {
      // This is the half that did nothing before.
      expect(
        socketOptions({ connect: { retries: 3, timeout: 20_000 } }).retries,
      ).toBe(3);
    });

    it("takes `retries: 0` as none rather than as unset", () => {
      expect(
        socketOptions({ connect: { retries: 0, timeout: 20_000 } }).retries,
      ).toBe(0);
    });

    it("retries at the interval its watchdog already waits", () => {
      const { retryDelay } = socketOptions({ connect: { timeout: 5000 } });

      expect(/** @type {() => number} */ (retryDelay)()).toBe(5000);
    });

    it("gives the client the silence it should tolerate", () => {
      expect(
        socketOptions({ connect: { timeout: 5000 } }).clientOptions,
      ).toStrictEqual({
        timeout: 5000,
      });
    });
  });

  // The two defaults the README quotes. `Infinity` is this module's; `10` is
  // `createSocket`'s, reached by handing it nothing — so the figure in the
  // docs is only right as long as both stay where they are.
  it("leaves each transport on the default the docs quote", () => {
    expect(socketOptions({ timeout: 20_000 }).retries).toBe(Infinity);
    expect(
      socketOptions({ transport: "ws", timeout: 20_000 }).retries,
    ).toBeUndefined();
    expect(createSocketDefaultRetries()).toBe(10);
  });

  describe("the shapes `connect` takes", () => {
    it("uses the defaults when it is `true`", () => {
      expect(socketOptions({ connect: true })).toStrictEqual({
        retries: Infinity,
        retryDelay: expect.any(Function),
        clientOptions: { timeout: 20_000 },
      });
    });

    it("uses them when it is `false` as well", () => {
      // `false` says not to connect on load, which the entry decides; if
      // something connects later it should still hold the line the same way.
      expect(socketOptions({ connect: false }).retries).toBe(Infinity);
    });

    it("fills in the half that was left out", () => {
      const { retryDelay, retries } = socketOptions({
        connect: { retries: 2 },
      });

      expect(retries).toBe(2);
      expect(/** @type {() => number} */ (retryDelay)()).toBe(20_000);
    });
  });

  describe("a WebSocket", () => {
    it("takes the number of attempts as given", () => {
      expect(
        socketOptions({
          transport: "ws",
          connect: { retries: 3, timeout: 20_000 },
        }).retries,
      ).toBe(3);
    });

    it("backs off rather than retrying on a fixed interval", () => {
      // A socket that dropped because the server is restarting should not be
      // asked again every `timeout` milliseconds.
      expect(
        socketOptions({ transport: "ws", connect: { timeout: 20_000 } })
          .retryDelay,
      ).toBeUndefined();
    });

    it("is handed no silence watchdog, having no way to run one", () => {
      // The heartbeat is a protocol ping here, which the browser answers in
      // its network stack and never shows to JavaScript — so a watchdog would
      // fire on a healthy idle connection. The server terminates half-open
      // sockets instead.
      expect(
        socketOptions({ transport: "ws", connect: { timeout: 20_000 } })
          .clientOptions,
      ).toBeUndefined();
    });
  });
});
