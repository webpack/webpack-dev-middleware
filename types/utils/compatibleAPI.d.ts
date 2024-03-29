/// <reference types="node" />
export type IncomingMessage = import("../index.js").IncomingMessage;
export type ServerResponse = import("../index.js").ServerResponse;
export type ExpectedResponse = {
  status?: ((status: number) => void) | undefined;
  send?: ((data: any) => void) | undefined;
  pipeInto?: ((data: any) => void) | undefined;
};
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/**
 * @typedef {Object} ExpectedResponse
 * @property {(status: number) => void} [status]
 * @property {(data: any) => void} [send]
 * @property {(data: any) => void} [pipeInto]
 */
/**
 * @template {ServerResponse & ExpectedResponse} Response
 * @param {Response} res
 * @param {number} code
 */
export function setStatusCode<
  Response extends import("http").ServerResponse<
    import("http").IncomingMessage
  > &
    import("../index.js").ExtendedServerResponse &
    ExpectedResponse,
>(res: Response, code: number): void;
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Response & ExpectedResponse} res
 * @param {string | Buffer} bufferOrStream
 */
export function send<
  Request extends import("http").IncomingMessage,
  Response extends import("../index.js").ServerResponse,
>(res: Response & ExpectedResponse, bufferOrStream: string | Buffer): void;
/**
 * @template {ServerResponse} Response
 * @param {Response & ExpectedResponse} res
 * @param {import("fs").ReadStream} bufferOrStream
 */
export function pipe<Response extends import("../index.js").ServerResponse>(
  res: Response & ExpectedResponse,
  bufferOrStream: import("fs").ReadStream,
): void;
/**
 * @param {string} filename
 * @param {import("../index").OutputFileSystem} outputFileSystem
 * @param {number} start
 * @param {number} end
 * @returns {{ bufferOrStream: (Buffer | import("fs").ReadStream), byteLength: number }}
 */
export function createReadStreamOrReadFileSync(
  filename: string,
  outputFileSystem: import("../index").OutputFileSystem,
  start: number,
  end: number,
): {
  bufferOrStream: Buffer | import("fs").ReadStream;
  byteLength: number;
};
