// What the two transports make of `reconnect` and `timeout` is not the same,
// because what they can observe is not the same.
//
// Server-Sent Events carry the heartbeat as data — `data: 💓` — so the client
// can tell a silent connection from a working one, and `timeout` is how long
// it waits before deciding. A WebSocket carries it as a protocol ping, which
// the browser answers in its network stack and never shows to JavaScript: a
// silence watchdog there would fire on a connection that is perfectly healthy
// and merely idle. The half-open case it would have caught is handled by the
// server instead, which can see the missing pong and terminates the socket, so
// the browser gets a real `close` and reconnects.
//
// Retries differ for a reason of their own: a dev server is expected to come
// back, and a tab left open across a restart has to find it again, so Server
// Sent Events keep trying for as long as the page is open. That is a default
// rather than a rule — asking for a bounded number of attempts is honoured.
const DEFAULT_SSE_RETRIES = Infinity;

/**
 * How `createSocket` should hold the connection open, for the transport in use.
 * @param {{ transport?: string, reconnect?: number, timeout?: number }} options the client options
 * @returns {{ retries: (number | undefined), retryDelay: (() => number) | undefined, clientOptions: { timeout?: number } | undefined }} what `createSocket` takes
 */
export default function socketOptions(options) {
  const isEventSource = options.transport !== "ws";

  if (!isEventSource) {
    return {
      retries: options.reconnect,
      // Left to `createSocket`, which backs off: a WebSocket that dropped
      // because the server is restarting should not be asked again on a fixed
      // interval.
      retryDelay: undefined,
      // `timeout` is the silence watchdog, which this transport has no way to
      // run, so there is nothing to hand the client.
      clientOptions: undefined,
    };
  }

  return {
    retries:
      options.reconnect === undefined ? DEFAULT_SSE_RETRIES : options.reconnect,
    retryDelay: () => /** @type {number} */ (options.timeout),
    clientOptions: { timeout: options.timeout },
  };
}
