export = createEventStream;
/**
 * @param {number} heartbeat heartbeat interval in milliseconds
 * @param {Logger} logger logger
 * @param {CorsOption=} cors which origins may read the stream, the local ones by default
 * @param {(string | false)=} token the token the endpoint requires, or false for none
 * @returns {EventStream} event stream
 */
declare function createEventStream(
  heartbeat: number,
  logger: Logger,
  cors?: CorsOption | undefined,
  token?: (string | false) | undefined,
): EventStream;
declare namespace createEventStream {
  export {
    createEventStream,
    IncomingMessage,
    ServerResponse,
    Logger,
    Payload,
    EventStream,
    StreamClient,
    CorsOption,
  };
}
type IncomingMessage = import("node:http").IncomingMessage;
type ServerResponse = import("../index.js").ServerResponse;
type Logger = import("../hot.js").Logger;
type Payload = import("../hot.js").Payload;
type EventStream = import("../hot.js").EventStream;
type StreamClient = import("../hot.js").StreamClient;
type CorsOption = import("../hot.js").CorsOption;
