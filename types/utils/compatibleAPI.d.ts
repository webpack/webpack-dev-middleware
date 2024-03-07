/// <reference types="node" />
export type IncomingMessage = import("../index.js").IncomingMessage;
export type ServerResponse = import("../index.js").ServerResponse;
export type ExpectedRequest = {
  get: (name: string) => string | undefined;
};
export type ExpectedResponse = {
  get: (name: string) => string | string[] | undefined;
  set: (name: string, value: number | string | string[]) => void;
  status: (status: number) => void;
  send: (data: any) => void;
};
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/**
 * @typedef {Object} ExpectedRequest
 * @property {(name: string) => string | undefined} get
 */
/**
 * @typedef {Object} ExpectedResponse
 * @property {(name: string) => string | string[] | undefined} get
 * @property {(name: string, value: number | string | string[]) => void} set
 * @property {(status: number) => void} status
 * @property {(data: any) => void} send
 */
/**
 * @template {ServerResponse} Response
 * @param {Response} res
 * @returns {string[]}
 */
export function getHeaderNames<
  Response extends import("../index.js").ServerResponse,
>(res: Response): string[];
/**
 * @template {IncomingMessage} Request
 * @param {Request} req
 * @param {string} name
 * @returns {string | undefined}
 */
export function getHeaderFromRequest<
  Request extends import("http").IncomingMessage,
>(req: Request, name: string): string | undefined;
/**
 * @template {ServerResponse} Response
 * @param {Response} res
 * @param {string} name
 * @returns {number | string | string[] | undefined}
 */
export function getHeaderFromResponse<
  Response extends import("../index.js").ServerResponse,
>(res: Response, name: string): number | string | string[] | undefined;
/**
 * @template {ServerResponse} Response
 * @param {Response} res
 * @param {string} name
 * @param {number | string | string[]} value
 * @returns {void}
 */
export function setHeaderForResponse<
  Response extends import("../index.js").ServerResponse,
>(res: Response, name: string, value: number | string | string[]): void;
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
 * @param {Request} req
 * @param {Response} res
 * @param {string | Buffer | import("fs").ReadStream} bufferOtStream
 * @param {number} byteLength
 */
export function send<
  Request extends import("http").IncomingMessage,
  Response extends import("../index.js").ServerResponse,
>(
  req: Request,
  res: Response,
  bufferOtStream: string | Buffer | import("fs").ReadStream,
  byteLength: number,
): void;
