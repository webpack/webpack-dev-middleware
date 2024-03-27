/// <reference types="node" />
export type IncomingMessage = import("../index.js").IncomingMessage;
export type ServerResponse = import("../index.js").ServerResponse;
export type ReadStream = import("fs").ReadStream;
export type ExpectedRequest = {
  get: (name: string) => string | undefined;
};
export type ExpectedResponse = {
  status?: ((status: number) => void) | undefined;
  send?: ((data: any) => void) | undefined;
  pipeInto?: ((data: any) => void) | undefined;
};
/**
 * send error options
 */
export type SendOptions<
  Request extends import("http").IncomingMessage,
  Response extends import("../index.js").ServerResponse,
> = {
  /**
   * headers
   */
  headers?: Record<string, number | string | string[] | undefined> | undefined;
  /**
   * modify response data callback
   */
  modifyResponseData?:
    | import("../index").ModifyResponseData<Request, Response>
    | undefined;
  /**
   * modify response data callback
   */
  outputFileSystem: import("../index").OutputFileSystem;
};
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/** @typedef {import("fs").ReadStream} ReadStream */
/**
 * @typedef {Object} ExpectedRequest
 * @property {(name: string) => string | undefined} get
 */
/**
 * @typedef {Object} ExpectedResponse
 * @property {(status: number) => void} [status]
 * @property {(data: any) => void} [send]
 * @property {(data: any) => void} [pipeInto]
 */
/**
 * @template {ServerResponse} Response
 * @param {Response} res
 * @param {number} code
 */
export function setStatusCode<
  Response extends import("../index.js").ServerResponse,
>(res: Response, code: number): void;
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @typedef {Object} SendOptions send error options
 * @property {Record<string, number | string | string[] | undefined>=} headers headers
 * @property {import("../index").ModifyResponseData<Request, Response>=} modifyResponseData modify response data callback
 * @property {import("../index").OutputFileSystem} outputFileSystem modify response data callback
 */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Request} req
 * @param {Response} res
 * @param {string} filename
 * @param {number} start
 * @param {number} end
 * @param {() => Promise<void>} goNext
 * @param {SendOptions<Request, Response>} options
 */
export function send<
  Request extends import("http").IncomingMessage,
  Response extends import("../index.js").ServerResponse,
>(
  req: Request,
  res: Response,
  filename: string,
  start: number,
  end: number,
  goNext: () => Promise<void>,
  options: SendOptions<Request, Response>,
): Promise<void>;
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Request} req response
 * @param {Response} res response
 * @param {number} status status
 * @param {Partial<SendOptions<Request, Response>>=} options options
 * @returns {void}
 */
export function sendError<
  Request extends import("http").IncomingMessage,
  Response extends import("../index.js").ServerResponse,
>(
  req: Request,
  res: Response,
  status: number,
  options?: Partial<SendOptions<Request, Response>> | undefined,
): void;
