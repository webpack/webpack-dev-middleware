/** @typedef {import("./createSocket.js").CommunicationClient} CommunicationClient */
/** @typedef {import("./createSocket.js").ClientHandler} ClientHandler */

/**
 * `WebSocket` only learned to resolve a relative or `http(s):` url recently —
 * Chrome 125, Firefox 124, Safari 17.3 — and throws a `SyntaxError` on one
 * before that. The default endpoint is a path, so it has to be resolved here
 * or this transport is unusable on every older browser, which are the ones
 * this runtime goes out of its way to support.
 * @param {string} url absolute or relative url
 * @returns {string} an absolute `ws:` or `wss:` url
 */
function toWebSocketURL(url) {
  if (/^wss?:\/\//i.test(url)) {
    return url;
  }

  // An anchor resolves a relative url against the document, and works in
  // browsers older than `URL`. A worker has no document but always has `URL`,
  // so it takes the other path.
  const absolute =
    typeof document === "undefined"
      ? new URL(url, self.location.href).href
      : (() => {
          const anchor = document.createElement("a");

          anchor.href = url;

          return anchor.href;
        })();

  // `href` is absolute either way, and its scheme maps one to one onto the
  // WebSocket ones: http to ws, https to wss.
  return absolute.replace(/^http/i, "ws");
}

/**
 * A WebSocket. The browser reports a dropped connection itself, and the server
 * pings to find a half-open one, so unlike Server-Sent Events this needs no
 * watchdog of its own.
 *
 * A failure is not logged here. The `error` event carries no detail by
 * specification, so it would print an opaque object, and it is followed by the
 * `close` the shared socket already reports and acts on — which is also all
 * Server-Sent Events say, so neither transport is noisier than the other.
 * @implements {CommunicationClient}
 */
export default class WebSocketClient {
  /**
   * @param {string} url url to connect to
   */
  constructor(url) {
    /** @type {ClientHandler | undefined} */
    this.openHandler = undefined;
    /** @type {ClientHandler | undefined} */
    this.closeHandler = undefined;
    /** @type {ClientHandler | undefined} */
    this.messageHandler = undefined;
    // Set once closed, so an event the socket had already queued cannot report
    // anything after the caller asked for none.
    this.closed = false;

    this.client = new WebSocket(toWebSocketURL(url));

    this.client.onopen = () => {
      if (this.openHandler) {
        this.openHandler();
      }
    };

    this.client.onclose = () => {
      if (this.closed) {
        return;
      }

      if (this.closeHandler) {
        this.closeHandler();
      }
    };

    this.client.onmessage = (event) => {
      if (this.closed) {
        return;
      }

      if (this.messageHandler) {
        this.messageHandler(event.data);
      }
    };
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
   * Close without reporting it, so the caller does not reconnect.
   */
  close() {
    this.closed = true;
    this.client.close();
  }
}
