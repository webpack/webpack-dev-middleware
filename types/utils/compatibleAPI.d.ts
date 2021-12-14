export type Request = import("../index.js").Request;
export type Response = import("../index.js").Response;
export type ExpressRequest = import("express").Request;
export type ExpressResponse = import("express").Response;
/** @typedef {import("../index.js").Request} Request */
/** @typedef {import("../index.js").Response} Response */
/** @typedef {import("express").Request} ExpressRequest */
/** @typedef {import("express").Response} ExpressResponse */
/**
 * @param {Response} res
 * @returns {string[]}
 */
export function getHeaderNames(res: Response): string[];
/**
 * @param {Request} req
 * @param {string} name
 * @returns {string | undefined}
 */
export function getHeaderFromRequest(
  req: Request,
  name: string
): string | undefined;
/**
 * @param {Response} res
 * @param {string} name
 * @returns {number | string | string[] | undefined}
 */
export function getHeaderFromResponse(
  res: Response,
  name: string
): number | string | string[] | undefined;
/**
 * @param {Response} res
 * @param {string} name
 * @param {number | string | string[]} value
 * @returns {void}
 */
export function setHeaderForResponse(
  res: Response,
  name: string,
  value: number | string | string[]
): void;
/**
 * @param {Response} res
 * @param {number} code
 */
export function setStatusCode(res: Response, code: number): void;
/**
 * @param {Request} req
 * @param {Response} res
 * @param {string | Buffer | import("fs").ReadStream} bufferOtStream
 * @param {number} byteLength
 */
export function send(
  req: Request,
  res: Response,
  bufferOtStream: string | Buffer | import("fs").ReadStream,
  byteLength: number
): void;
