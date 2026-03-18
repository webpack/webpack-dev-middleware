export = wrapper;
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("./index.js").FilledContext<Request, Response>} context context
 * @returns {import("./index.js").Middleware<Request, Response>} wrapper
 */
declare function wrapper<
  Request extends IncomingMessage,
  Response extends ServerResponse,
>(
  context: import("./index.js").FilledContext<Request, Response>,
): import("./index.js").Middleware<Request, Response>;
declare namespace wrapper {
  export {
    getFilenameFromUrl,
    ready,
    FilenameWithExtra,
    SendErrorOptions,
    ReadStream,
    Compiler,
    Stats,
    MultiStats,
    Asset,
    NextFunction,
    IncomingMessage,
    ServerResponse,
    NormalizedHeaders,
    OutputFileSystem,
    Extra,
  };
}
/** @typedef {{ filename: string, extra: Extra }} FilenameWithExtra */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("./index.js").FilledContext<Request, Response>} context context
 * @param {string} url url
 * @returns {FilenameWithExtra | undefined} result of get filename from url
 */
declare function getFilenameFromUrl<
  Request extends IncomingMessage,
  Response extends ServerResponse,
>(
  context: import("./index.js").FilledContext<Request, Response>,
  url: string,
): FilenameWithExtra | undefined;
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @typedef {object} SendErrorOptions send error options
 * @property {Record<string, number | string | string[] | undefined>=} headers headers
 * @property {import("./index").ModifyResponseData<Request, Response>=} modifyResponseData modify response data callback
 */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("./index.js").FilledContext<Request, Response>} context context
 * @param {import("./index.js").Callback} callback callback
 * @param {Request=} req req
 * @returns {void}
 */
declare function ready<
  Request extends IncomingMessage,
  Response extends ServerResponse,
>(
  context: import("./index.js").FilledContext<Request, Response>,
  callback: import("./index.js").Callback,
  req?: Request | undefined,
): void;
type FilenameWithExtra = {
  filename: string;
  extra: Extra;
};
/**
 * send error options
 */
type SendErrorOptions<
  Request extends IncomingMessage,
  Response extends ServerResponse,
> = {
  /**
   * headers
   */
  headers?: Record<string, number | string | string[] | undefined> | undefined;
  /**
   * modify response data callback
   */
  modifyResponseData?:
    | import("./index").ModifyResponseData<Request, Response>
    | undefined;
};
type ReadStream = import("fs").ReadStream;
type Compiler = import("webpack").Compiler;
type Stats = import("webpack").Stats;
type MultiStats = import("webpack").MultiStats;
type Asset = import("webpack").Asset;
type NextFunction = import("./index.js").NextFunction;
type IncomingMessage = import("./index.js").IncomingMessage;
type ServerResponse = import("./index.js").ServerResponse;
type NormalizedHeaders = import("./index.js").NormalizedHeaders;
type OutputFileSystem = import("./index.js").OutputFileSystem;
type Extra = {
  /**
   * stats
   */
  stats: import("fs").Stats;
  /**
   * true when immutable, otherwise false
   */
  immutable?: boolean | undefined;
  /**
   * outputFileSystem
   */
  outputFileSystem: OutputFileSystem;
};
