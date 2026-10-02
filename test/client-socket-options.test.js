import socketOptions from "../client-src/utils/socket-options";

// `reconnect` and `timeout` mean different things to the two transports, and
// before this each was silently inert on one of them: `reconnect` was ignored
// over Server-Sent Events, which always retried forever, and `timeout` was
// handed to a WebSocket client whose constructor takes no options at all.
describe("what each transport makes of reconnect and timeout", () => {
  describe("Server-Sent Events", () => {
    it("keeps trying for as long as the page is open, by default", () => {
      // A dev server is expected to come back, and a tab left open across a
      // restart has to find it again.
      expect(socketOptions({ timeout: 20_000 }).retries).toBe(Infinity);
    });

    it("honours a bounded number of attempts when one was asked for", () => {
      // This is the half that did nothing before.
      expect(socketOptions({ reconnect: 3, timeout: 20_000 }).retries).toBe(3);
    });

    it("takes `reconnect: 0` as none rather than as unset", () => {
      expect(socketOptions({ reconnect: 0, timeout: 20_000 }).retries).toBe(0);
    });

    it("retries at the interval its watchdog already waits", () => {
      const { retryDelay } = socketOptions({ timeout: 5000 });

      expect(/** @type {() => number} */ (retryDelay)()).toBe(5000);
    });

    it("gives the client the silence it should tolerate", () => {
      expect(socketOptions({ timeout: 5000 }).clientOptions).toStrictEqual({
        timeout: 5000,
      });
    });
  });

  describe("a WebSocket", () => {
    it("takes the number of attempts as given", () => {
      expect(
        socketOptions({ transport: "ws", reconnect: 3, timeout: 20_000 })
          .retries,
      ).toBe(3);
    });

    it("backs off rather than retrying on a fixed interval", () => {
      // A socket that dropped because the server is restarting should not be
      // asked again every `timeout` milliseconds.
      expect(
        socketOptions({ transport: "ws", timeout: 20_000 }).retryDelay,
      ).toBeUndefined();
    });

    it("is handed no silence watchdog, having no way to run one", () => {
      // The heartbeat is a protocol ping here, which the browser answers in
      // its network stack and never shows to JavaScript — so a watchdog would
      // fire on a healthy idle connection. The server terminates half-open
      // sockets instead.
      expect(
        socketOptions({ transport: "ws", timeout: 20_000 }).clientOptions,
      ).toBeUndefined();
    });
  });
});
