export = EventStream;
/**
 * EventStream implementation for Server-Sent Events (SSE)
 * Used to push Hot Module Replacement updates to connected clients
 */
/** @typedef {import("http").ServerResponse} ServerResponse */
/**
 * @typedef {object} EventStreamClient
 * @property {ServerResponse} response The HTTP response object
 * @property {NodeJS.Timeout | undefined} heartbeatTimer Timer for heartbeat messages
 */
/**
 * @typedef {object} EventStreamOptions
 * @property {number=} heartbeat Heartbeat interval in milliseconds (default: 10000)
 * @property {string=} path The path for the event stream endpoint (default: "/__webpack_hmr")
 */
declare class EventStream {
  /**
   * @param {EventStreamOptions=} options Configuration options
   */
  constructor(options?: EventStreamOptions | undefined);
  /** @type {EventStreamClient[]} */
  clients: EventStreamClient[];
  /** @type {number} */
  heartbeatInterval: number;
  /** @type {string} */
  path: string;
  /** @type {(() => void) | undefined} */
  closeCallback: (() => void) | undefined;
  /**
   * Handle a new client connection
   * @param {import("http").IncomingMessage} req The request object
   * @param {ServerResponse} res The response object
   * @returns {void}
   */
  handler(req: import("http").IncomingMessage, res: ServerResponse): void;
  /**
   * Send a message to a specific client
   * @param {EventStreamClient} client The client to send to
   * @param {object} payload The data to send
   * @returns {boolean} Whether the message was sent successfully
   */
  sendToClient(client: EventStreamClient, payload: object): boolean;
  /**
   * Broadcast a message to all connected clients
   * @param {object} payload The data to broadcast
   * @returns {void}
   */
  publish(payload: object): void;
  /**
   * Remove a client from the list
   * @param {EventStreamClient} client The client to remove
   * @returns {void}
   */
  removeClient(client: EventStreamClient): void;
  /**
   * Close all connections and clean up
   * @returns {void}
   */
  close(): void;
  /**
   * Check if a request is for the event stream endpoint
   * @param {string} url The request URL
   * @returns {boolean} Whether the URL matches the event stream path
   */
  isEventStreamRequest(url: string): boolean;
  /**
   * Get the number of connected clients
   * @returns {number} Number of connected clients
   */
  getClientCount(): number;
  /**
   * Set a callback to be called when the stream is closed
   * @param {() => void} callback The callback function
   * @returns {void}
   */
  onClose(callback: () => void): void;
}
declare namespace EventStream {
  export { ServerResponse, EventStreamClient, EventStreamOptions };
}
type ServerResponse = import("http").ServerResponse;
type EventStreamClient = {
  /**
   * The HTTP response object
   */
  response: ServerResponse;
  /**
   * Timer for heartbeat messages
   */
  heartbeatTimer: NodeJS.Timeout | undefined;
};
type EventStreamOptions = {
  /**
   * Heartbeat interval in milliseconds (default: 10000)
   */
  heartbeat?: number | undefined;
  /**
   * The path for the event stream endpoint (default: "/__webpack_hmr")
   */
  path?: string | undefined;
};
