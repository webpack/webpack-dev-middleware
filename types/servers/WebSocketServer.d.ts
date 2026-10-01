export = createWebSocketStream;
/**
 * A client stream carried over WebSocket rather than Server-Sent Events. It
 * answers the same calls as `createEventStream`, so `createHot` does not know
 * which of them it is publishing to.
 * @param {object} options options
 * @param {string} options.path the path the endpoint is served at
 * @param {number} options.heartbeat heartbeat interval in milliseconds
 * @param {CorsOption=} options.cors which origins may connect, the local ones by default
 * @param {Logger} logger logger
 * @returns {ClientStream} client stream
 */
declare function createWebSocketStream(
  {
    path,
    heartbeat,
    cors,
  }: {
    path: string;
    heartbeat: number;
    cors?: CorsOption | undefined;
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
    CorsOption,
  };
}
declare const WS_DEFAULT_HEARTBEAT: number;
type HttpServer = import("node:http").Server;
type IncomingMessage = import("node:http").IncomingMessage;
type Duplex = import("node:stream").Duplex;
type WebSocket = import("ws").WebSocket;
type WsServerConstructor = typeof import("ws").WebSocketServer;
type Logger = import("../hot.js").Logger;
type Payload = import("../hot.js").Payload;
type ClientStream = import("../hot.js").ClientStream;
type CorsOption = import("../hot.js").CorsOption;
