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
 * Hold a connection open, reconnecting when it drops, and fan each message out
 * to everyone listening. What "reconnect" costs is the transport's to say: a
 * dropped WebSocket backs off, whereas Server-Sent Events retries at a steady
 * interval for as long as the page is open.
 * @param {CommunicationClientConstructor} Client what speaks the transport
 * @param {string} url url to connect to
 * @param {SocketOptions=} options how it reconnects
 * @returns {{ addMessageListener: (fn: (event: { data: string }) => void) => void, close: () => void }} the socket
 */
export default function createSocket(
  Client: CommunicationClientConstructor,
  url: string,
  options?: SocketOptions | undefined,
): {
  addMessageListener: (fn: (event: { data: string }) => void) => void;
  close: () => void;
};
/**
 * Called with no argument for open and close, and with the message string for
 * a message.
 */
export type ClientHandler = (data?: string) => void;
/**
 * One transport, as the page speaks it. Constructed with the url, the same
 * shape webpack-dev-server's `client.webSocketTransport` has always taken, so
 * a client written for that works here unchanged.
 */
export type CommunicationClient = {
  /**
   * called once the connection is open
   */
  onOpen: (fn: ClientHandler) => void;
  /**
   * called once the connection is gone
   */
  onClose: (fn: ClientHandler) => void;
  /**
   * called with each message, as a string
   */
  onMessage: (fn: ClientHandler) => void;
  /**
   * close without reporting it
   */
  close: () => void;
};
export type CommunicationClientConstructor = new (
  url: string,
  options?: EXPECTED_ANY,
) => CommunicationClient;
export type EXPECTED_ANY = any;
export type SocketOptions = {
  /**
   * how many times to reconnect before giving up, `Infinity` to keep trying
   */
  retries?: number | undefined;
  /**
   * how long to wait before the attempt, in milliseconds
   */
  retryDelay?: ((attempt: number) => number) | undefined;
  /**
   * say so before each attempt, which only a bounded number of them can afford to do
   */
  logRetries?: boolean | undefined;
  /**
   * called once per outage — on the first drop, whether or not that connection ever opened
   */
  onDisconnect?: (() => void) | undefined;
  /**
   * passed to the client's constructor
   */
  clientOptions?: EXPECTED_ANY | undefined;
};
