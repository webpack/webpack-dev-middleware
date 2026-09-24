import { log } from "../utils/log.js";

/** @typedef {import("./createSocket.js").CommunicationClient} CommunicationClient */
/** @typedef {import("./createSocket.js").ClientHandler} ClientHandler */

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
    this.client = new WebSocket(url);
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
