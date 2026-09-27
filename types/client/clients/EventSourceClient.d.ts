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
export default class EventSourceClient implements CommunicationClient {
  /**
   * @param {string} url url to connect to
   * @param {{ timeout?: number }=} options how long silence is tolerated
   */
  constructor(
    url: string,
    options?:
      | {
          timeout?: number;
        }
      | undefined,
  );
  timeout: number;
  /** @type {ClientHandler | undefined} */
  openHandler: ClientHandler | undefined;
  /** @type {ClientHandler | undefined} */
  closeHandler: ClientHandler | undefined;
  /** @type {ClientHandler | undefined} */
  messageHandler: ClientHandler | undefined;
  closed: boolean;
  lastActivity: number;
  client: EventSource;
  timer: number;
  /**
   * End this connection and report it, once.
   */
  handleDisconnect(): void;
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
   * Stop the watchdog and the connection, without reporting a close.
   */
  close(): void;
}
export type CommunicationClient =
  import("./createSocket.js").CommunicationClient;
export type ClientHandler = import("./createSocket.js").ClientHandler;
