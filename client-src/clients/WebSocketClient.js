import { log } from "../utils/log.js";

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

  const anchor = document.createElement("a");

  anchor.href = url;

  // Read back, `href` is absolute, and its scheme maps one to one onto the
  // WebSocket ones: http to ws, https to wss.
  return anchor.href.replace(/^http/i, "ws");
}

/**
 * A WebSocket. The browser reports a dropped connection itself, and the server
 * pings to find a half-open one, so unlike Server-Sent Events this needs no
 * watchdog of its own.
 * @implements {CommunicationClient}
 */
export default class WebSocketClient {
  /**
   * @param {string} url url to connect to
   */
  constructor(url) {
    this.client = new WebSocket(toWebSocketURL(url));
    this.client.onerror = (error) => {
      log.error(error);
    };
  }

  /**
   * @param {ClientHandler} fn called once the connection is open
   */
  onOpen(fn) {
    this.client.onopen = () => {
      fn();
    };
  }

  /**
   * @param {ClientHandler} fn called once the connection is gone
   */
  onClose(fn) {
    this.client.onclose = () => {
      fn();
    };
  }

  /**
   * @param {ClientHandler} fn called with each message, as a string
   */
  onMessage(fn) {
    this.client.onmessage = (event) => {
      fn(event.data);
    };
  }

  /**
   * Close without reporting it, so the caller does not reconnect.
   */
  close() {
    this.client.onclose = null;
    this.client.close();
  }
}
