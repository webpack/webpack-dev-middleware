/** @typedef {import("./createSocket.js").CommunicationClient} CommunicationClient */
/** @typedef {import("./createSocket.js").ClientHandler} ClientHandler */

// Long enough that a slow build does not look like a dead connection.
const DEFAULT_TIMEOUT = 20 * 1000;

/**
 * Server-Sent Events. A connection can die without the browser firing `error`
 * — a proxy that stops forwarding, a laptop that slept — so this one watches
 * for silence as well, and reports that as a close for the caller to reconnect.
 *
 * A failure is not logged here, for the same reason the WebSocket one does not
 * log it: `error` fires on every routine reconnection, so saying so would be
 * noise rather than news.
 * @implements {CommunicationClient}
 */
export default class EventSourceClient {
  /**
   * @param {string} url url to connect to
   * @param {{ timeout?: number }=} options how long silence is tolerated
   */
  constructor(url, options = {}) {
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    /** @type {ClientHandler | undefined} */
    this.openHandler = undefined;
    /** @type {ClientHandler | undefined} */
    this.closeHandler = undefined;
    /** @type {ClientHandler | undefined} */
    this.messageHandler = undefined;
    // Set once closed, so an `error` the EventSource had already queued cannot
    // report a close after the caller asked for none.
    this.closed = false;
    this.lastActivity = Date.now();

    this.client = new window.EventSource(url);

    this.client.addEventListener("open", () => {
      if (this.closed) {
        return;
      }

      this.lastActivity = Date.now();

      if (this.openHandler) {
        this.openHandler();
      }
    });

    this.client.addEventListener("message", (event) => {
      if (this.closed) {
        return;
      }

      this.lastActivity = Date.now();

      if (this.messageHandler) {
        this.messageHandler(/** @type {{ data: string }} */ (event).data);
      }
    });

    this.client.addEventListener("error", () => {
      this.handleDisconnect();
    });

    // Halved so silence is noticed within one `timeout` rather than two.
    this.timer = setInterval(() => {
      if (Date.now() - this.lastActivity > this.timeout) {
        this.handleDisconnect();
      }
    }, this.timeout / 2);
  }

  /**
   * End this connection and report it, once.
   */
  handleDisconnect() {
    if (this.closed) {
      return;
    }

    this.close();

    if (this.closeHandler) {
      this.closeHandler();
    }
  }

  /**
   * @param {ClientHandler} fn called once the connection is open
   */
  onOpen(fn) {
    this.openHandler = fn;
  }

  /**
   * @param {ClientHandler} fn called once the connection is gone
   */
  onClose(fn) {
    this.closeHandler = fn;
  }

  /**
   * @param {ClientHandler} fn called with each message, as a string
   */
  onMessage(fn) {
    this.messageHandler = fn;
  }

  /**
   * Stop the watchdog and the connection, without reporting a close.
   */
  close() {
    this.closed = true;
    clearInterval(this.timer);
    this.client.close();
  }
}
