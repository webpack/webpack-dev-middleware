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
export default class WebSocketClient implements CommunicationClient {
  /**
   * @param {string} url url to connect to
   */
  constructor(url: string);
  /** @type {ClientHandler | undefined} */
  openHandler: ClientHandler | undefined;
  /** @type {ClientHandler | undefined} */
  closeHandler: ClientHandler | undefined;
  /** @type {ClientHandler | undefined} */
  messageHandler: ClientHandler | undefined;
  closed: boolean;
  client: WebSocket;
  /**
   * @param {ClientHandler} fn called once the connection is open
   */
  onOpen(fn: ClientHandler): void;
  /**
   * @param {ClientHandler} fn called once the connection is gone
   */
  onClose(fn: ClientHandler): void;
  /**
   * @param {ClientHandler} fn called with each message, as a string
   */
  onMessage(fn: ClientHandler): void;
  /**
   * Close without reporting it, so the caller does not reconnect.
   */
  close(): void;
}
export type CommunicationClient =
  import("./createSocket.js").CommunicationClient;
export type ClientHandler = import("./createSocket.js").ClientHandler;
