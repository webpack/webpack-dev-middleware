import { log } from "../utils/log.js";

/**
 * Called with no argument for open and close, and with the message string for
 * a message.
 * @typedef {(data?: string) => void} ClientHandler
 */

/**
 * One transport, as the page speaks it. Constructed with the url, the same
 * shape webpack-dev-server's `client.webSocketTransport` has always taken, so
 * a client written for that works here unchanged.
 * @typedef {object} CommunicationClient
 * @property {(fn: ClientHandler) => void} onOpen called once the connection is open
 * @property {(fn: ClientHandler) => void} onClose called once the connection is gone
 * @property {(fn: ClientHandler) => void} onMessage called with each message, as a string
 * @property {() => void} close close without reporting it
 */

/**
 * @typedef {new (url: string, options?: EXPECTED_ANY) => CommunicationClient} CommunicationClientConstructor
 */

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/**
 * @typedef {object} SocketOptions
 * @property {number=} retries how many times to reconnect before giving up, `Infinity` to keep trying
 * @property {((attempt: number) => number)=} retryDelay how long to wait before the attempt, in milliseconds
 * @property {boolean=} logRetries say so before each attempt, which only a bounded number of them can afford to do
 * @property {(() => void)=} onDisconnect called once per outage — on the first drop, whether or not that connection ever opened
 * @property {EXPECTED_ANY=} clientOptions passed to the client's constructor
 */

/**
 * A connection as `client` hands it out. Its own `client` is the `WebSocket`
 * or `EventSource` underneath, on the built-in transports.
 * @typedef {CommunicationClient & { client?: WebSocket | EventSource }} LiveClient
 */

/**
 * The connection the runtime holds right now, or `null` while there is none —
 * for tooling that listens alongside the runtime rather than through it.
 * `client.client` is the `WebSocket` or `EventSource` underneath, the shape
 * webpack-dev-server's `client/socket` has always exported, which is what
 * `@pmmmwh/react-refresh-webpack-plugin` reads its build messages from.
 * @type {LiveClient | null}
 */
// eslint-disable-next-line import/no-mutable-exports
export let client = null;

/**
 * Hold a connection open, reconnecting when it drops, and fan each message out
 * to everyone listening. What "reconnect" costs is the transport's to say: a
 * dropped WebSocket backs off, whereas Server-Sent Events retries at a steady
 * interval for as long as the page is open.
 * @param {CommunicationClientConstructor} Client what speaks the transport
 * @param {string} url url to connect to
 * @param {SocketOptions=} options how it reconnects
 * @returns {{ addMessageListener: (fn: (event: { data: string }) => void) => void, close: () => void }} the socket
 */
export default function createSocket(Client, url, options = {}) {
  const retries = options.retries === undefined ? 10 : options.retries;
  // A transport that keeps trying for as long as the page is open would
  // otherwise say so every few seconds, all day.
  const logRetries =
    options.logRetries === undefined
      ? retries !== Infinity
      : options.logRetries;
  const retryDelay =
    options.retryDelay ||
    // Respectfully copied from the package `got`.
    ((attempt) => 1000 * 2 ** attempt + Math.random() * 100);

  /** @type {((event: { data: string }) => void)[]} */
  const listeners = [];
  /** @type {CommunicationClient | null} */
  let current = null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  let attempt = 0;
  let closed = false;

  const open = () => {
    current = new Client(url, options.clientOptions);
    client = current;

    current.onOpen(() => {
      // Said here rather than in a transport, or whichever one did not say it
      // would leave the page with no sign it had connected at all.
      log.info("connected");
      attempt = 0;
    });

    current.onClose(() => {
      // Only if it is still the one exported: two endpoints on one page each
      // hold a connection, and one dropping says nothing about the other.
      if (client === current) {
        client = null;
      }

      current = null;

      // Once per outage rather than once per failed attempt: the retries that
      // follow are this module reconnecting, not the connection going away
      // again. `attempt` is back to zero for every connection that opened.
      //
      // A first attempt that never opened reports too, which is deliberate: a
      // page loaded while the server is down has no connection either, and
      // saying so is what webpack-dev-server's client has always done.
      if (!closed && attempt === 0 && options.onDisconnect) {
        options.onDisconnect();
      }

      if (closed || attempt >= retries) {
        return;
      }

      const delay = retryDelay(attempt);

      attempt += 1;

      if (logRetries) {
        log.info("Trying to reconnect...");
      }

      timer = setTimeout(open, delay);
    });

    current.onMessage((data) => {
      for (const listener of listeners) {
        listener({ data: /** @type {string} */ (data) });
      }
    });
  };

  open();

  return {
    addMessageListener(fn) {
      listeners.push(fn);
    },
    close() {
      // Set before closing, so a close event the transport had already queued
      // cannot schedule a reconnection after this.
      closed = true;
      clearTimeout(timer);

      if (current) {
        current.close();

        if (client === current) {
          client = null;
        }

        current = null;
      }
    },
  };
}
