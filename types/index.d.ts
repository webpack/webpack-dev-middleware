/// <reference types="node" />
/** @typedef {import("schema-utils/declarations/validate").Schema} Schema */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Configuration} Configuration */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/**
 * @typedef {Object} ExtendedServerResponse
 * @property {{ webpack?: { devMiddleware?: Context<any, any> } }} [locals]
 */
/** @typedef {import("http").IncomingMessage} IncomingMessage */
/** @typedef {import("http").ServerResponse & ExtendedServerResponse} ServerResponse */
/**
 * @callback NextFunction
 * @param {any} [err]
 * @return {void}
 */
/**
 * @typedef {NonNullable<Configuration["watchOptions"]>} WatchOptions
 */
/**
 * @typedef {Compiler["watching"]} Watching
 */
/**
 * @typedef {ReturnType<Compiler["watch"]>} MultiWatching
 */
/**
 * @typedef {Compiler["outputFileSystem"] & { createReadStream?: import("fs").createReadStream, statSync?: import("fs").statSync, lstat?: import("fs").lstat, readFileSync?: import("fs").readFileSync }} OutputFileSystem
 */
/** @typedef {ReturnType<Compiler["getInfrastructureLogger"]>} Logger */
/**
 * @callback Callback
 * @param {Stats | MultiStats} [stats]
 */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @typedef {Object} Context
 * @property {boolean} state
 * @property {Stats | MultiStats | undefined} stats
 * @property {Callback[]} callbacks
 * @property {Options<Request, Response>} options
 * @property {Compiler | MultiCompiler} compiler
 * @property {Watching | MultiWatching} watching
 * @property {Logger} logger
 * @property {OutputFileSystem} outputFileSystem
 */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @typedef {Record<string, string | number> | Array<{ key: string, value: number | string }> | ((req: Request, res: Response, context: Context<Request, Response>) =>  void | undefined | Record<string, string | number>) | undefined} Headers
 */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @typedef {Object} Options
 * @property {{[key: string]: string}} [mimeTypes]
 * @property {boolean | ((targetPath: string) => boolean)} [writeToDisk]
 * @property {string} [methods]
 * @property {Headers<Request, Response>} [headers]
 * @property {NonNullable<Configuration["output"]>["publicPath"]} [publicPath]
 * @property {Configuration["stats"]} [stats]
 * @property {boolean} [serverSideRender]
 * @property {OutputFileSystem} [outputFileSystem]
 * @property {boolean | string} [index]
 */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @callback Middleware
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @return {Promise<void>}
 */
/**
 * @callback GetFilenameFromUrl
 * @param {string} url
 * @returns {string | undefined}
 */
/**
 * @callback WaitUntilValid
 * @param {Callback} callback
 */
/**
 * @callback Invalidate
 * @param {Callback} callback
 */
/**
 * @callback Close
 * @param {(err?: Error) => void} callback
 */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @typedef {Object} AdditionalMethods
 * @property {GetFilenameFromUrl} getFilenameFromUrl
 * @property {WaitUntilValid} waitUntilValid
 * @property {Invalidate} invalidate
 * @property {Close} close
 * @property {Context<Request, Response>} context
 */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @typedef {Middleware<Request, Response> & AdditionalMethods<Request, Response>} API
 */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {Compiler | MultiCompiler} compiler
 * @param {Options<Request, Response>} [options]
 * @returns {API<Request, Response>}
 */
export default function wdm<
  Request_1 extends import("http").IncomingMessage,
  Response_1 extends ServerResponse
>(
  compiler: Compiler | MultiCompiler,
  options?: Options<Request_1, Response_1> | undefined
): API<Request_1, Response_1>;
export type Schema = import("schema-utils/declarations/validate").Schema;
export type Compiler = import("webpack").Compiler;
export type MultiCompiler = import("webpack").MultiCompiler;
export type Configuration = import("webpack").Configuration;
export type Stats = import("webpack").Stats;
export type MultiStats = import("webpack").MultiStats;
export type ExtendedServerResponse = {
  locals?:
    | {
        webpack?:
          | {
              devMiddleware?: Context<any, any> | undefined;
            }
          | undefined;
      }
    | undefined;
};
export type IncomingMessage = import("http").IncomingMessage;
export type ServerResponse = import("http").ServerResponse &
  ExtendedServerResponse;
export type NextFunction = (err?: any) => void;
export type WatchOptions = NonNullable<Configuration["watchOptions"]>;
export type Watching = Compiler["watching"];
export type MultiWatching = ReturnType<Compiler["watch"]>;
export type OutputFileSystem = Compiler["outputFileSystem"] & {
  createReadStream?: typeof import("fs").createReadStream;
  statSync?: import("fs").StatSyncFn;
  lstat?: typeof import("fs").lstat;
  readFileSync?: typeof import("fs").readFileSync;
};
export type Logger = ReturnType<Compiler["getInfrastructureLogger"]>;
export type Callback = (
  stats?: import("webpack").Stats | import("webpack").MultiStats | undefined
) => any;
export type Context<
  Request_1 extends import("http").IncomingMessage,
  Response_1 extends ServerResponse
> = {
  state: boolean;
  stats: Stats | MultiStats | undefined;
  callbacks: Callback[];
  options: Options<Request_1, Response_1>;
  compiler: Compiler | MultiCompiler;
  watching: Watching | MultiWatching;
  logger: Logger;
  outputFileSystem: OutputFileSystem;
};
export type Headers<
  Request_1 extends import("http").IncomingMessage,
  Response_1 extends ServerResponse
> =
  | Record<string, string | number>
  | {
      key: string;
      value: number | string;
    }[]
  | ((
      req: Request_1,
      res: Response_1,
      context: Context<Request_1, Response_1>
    ) => void | undefined | Record<string, string | number>)
  | undefined;
export type Options<
  Request_1 extends import("http").IncomingMessage,
  Response_1 extends ServerResponse
> = {
  mimeTypes?:
    | {
        [key: string]: string;
      }
    | undefined;
  writeToDisk?: boolean | ((targetPath: string) => boolean) | undefined;
  methods?: string | undefined;
  headers?: Headers<Request_1, Response_1>;
  publicPath?: NonNullable<Configuration["output"]>["publicPath"];
  stats?: Configuration["stats"];
  serverSideRender?: boolean | undefined;
  outputFileSystem?: OutputFileSystem | undefined;
  index?: string | boolean | undefined;
};
export type Middleware<
  Request_1 extends import("http").IncomingMessage,
  Response_1 extends ServerResponse
> = (req: Request_1, res: Response_1, next: NextFunction) => Promise<void>;
export type GetFilenameFromUrl = (url: string) => string | undefined;
export type WaitUntilValid = (callback: Callback) => any;
export type Invalidate = (callback: Callback) => any;
export type Close = (callback: (err?: Error | undefined) => void) => any;
export type AdditionalMethods<
  Request_1 extends import("http").IncomingMessage,
  Response_1 extends ServerResponse
> = {
  getFilenameFromUrl: GetFilenameFromUrl;
  waitUntilValid: WaitUntilValid;
  invalidate: Invalidate;
  close: Close;
  context: Context<Request_1, Response_1>;
};
export type API<
  Request_1 extends import("http").IncomingMessage,
  Response_1 extends ServerResponse
> = Middleware<Request_1, Response_1> &
  AdditionalMethods<Request_1, Response_1>;
