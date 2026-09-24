export = createWebSocketStream;
/**
 * A client stream carried over WebSocket rather than Server-Sent Events. It
 * answers the same calls as `createEventStream`, so `createHot` does not know
 * which of them it is publishing to.
 * @param {object} options options
 * @param {string} options.path the path the endpoint is served at
 * @param {number} options.heartbeat heartbeat interval in milliseconds
 * @param {Logger} logger logger
 * @returns {ClientStream} client stream
 */
declare function createWebSocketStream(
  {
    path,
    heartbeat,
  }: {
    path: string;
    heartbeat: number;
  },
  logger: Logger,
): ClientStream;
declare namespace createWebSocketStream {
  export {
    WS_DEFAULT_HEARTBEAT,
    createWebSocketStream,
    HttpServer,
    IncomingMessage,
    Duplex,
    WebSocket,
    WsServerConstructor,
    Logger,
    Payload,
    ClientStream,
  };
}
/** @typedef {import("node:http").Server} HttpServer */
/** @typedef {import("node:http").IncomingMessage} IncomingMessage */
/** @typedef {import("node:stream").Duplex} Duplex */
/** @typedef {import("ws").WebSocket} WebSocket */
/** @typedef {typeof import("ws").WebSocketServer} WsServerConstructor */
/** @typedef {import("../hot.js").Logger} Logger */
/** @typedef {import("../hot.js").Payload} Payload */
/** @typedef {import("../hot.js").ClientStream} ClientStream */
declare const WS_DEFAULT_HEARTBEAT: number;
type HttpServer = import("node:http").Server;
type IncomingMessage = import("node:http").IncomingMessage;
type Duplex = import("node:stream").Duplex;
type WebSocket = import("ws").WebSocket;
type WsServerConstructor = typeof import("ws").WebSocketServer;
type Logger = import("../hot.js").Logger;
type Payload = import("../hot.js").Payload;
type ClientStream = import("../hot.js").ClientStream;
