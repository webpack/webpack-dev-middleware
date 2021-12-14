/// <reference types="node" />
/** @typedef {import("schema-utils/declarations/validate").Schema} Schema */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Configuration} Configuration */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {ReturnType<Compiler["getInfrastructureLogger"]>} Logger */
/** @typedef {import("http").IncomingMessage} IncomingMessage */
/** @typedef {import("http").ServerResponse} ServerResponse */
/** @typedef {import("express").Request} ExpressRequest */
/** @typedef {import("express").Response} ExpressResponse */
/**
 * @typedef {any} TODO
 */
/**
 * @typedef {IncomingMessage | ExpressRequest} Request
 */
/**
 * @typedef {(ServerResponse | ExpressResponse) & { locals?: { webpack?: { devMiddleware?: Context } } }} Response
 */
/**
 * @callback Next
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
/**
 * @typedef {Object} Context
 * @property {boolean} state
 * @property {Stats | MultiStats | undefined} stats
 * @property {Function[]} callbacks
 * @property {Options} options
 * @property {Compiler | MultiCompiler} compiler
 * @property {Watching | MultiWatching} watching
 * @property {Logger} logger
 * @property {OutputFileSystem} outputFileSystem
 */
/**
 * @typedef {Record<string, number | string> | Array<{ key: string, value: number | string }> | ((req: Request, res: Response, context: Context) => Record<string, number | string>)} Headers
 */
/**
 * @typedef {Object} Options
 * @property {{[key: string]: string}} [mimeTypes]
 * @property {boolean | TODO} [writeToDisk]
 * @property {string} [methods]
 * @property {Headers} [headers]
 * @property {NonNullable<Configuration["output"]>["publicPath"]} [publicPath]
 * @property {Configuration["stats"]} [stats]
 * @property {boolean} [serverSideRender]
 * @property {OutputFileSystem} [outputFileSystem]
 * @property {boolean | string} [index]
 */
/**
 * @callback Middleware
 * @param {Request} req
 * @param {Response} res
 * @param {Next} next
 */
/**
 * @typedef {Object} AdditionalMethods
 * @property {TODO} getFilenameFromUrl
 * @property {TODO} waitUntilValid
 * @property {TODO} invalidate
 * @property {TODO} close
 * @property {Context} context
 */
/**
 * @typedef {Middleware & AdditionalMethods} API
 */
/**
 * @param {Compiler | MultiCompiler} compiler
 * @param {Options} [options]
 * @returns {API}
 */
export default function wdm(
  compiler: Compiler | MultiCompiler,
  options?: Options | undefined
): API;
export type Schema = import("schema-utils/declarations/validate").Schema;
export type Compiler = import("webpack").Compiler;
export type MultiCompiler = import("webpack").MultiCompiler;
export type Configuration = import("webpack").Configuration;
export type Stats = import("webpack").Stats;
export type MultiStats = import("webpack").MultiStats;
export type Logger = ReturnType<Compiler["getInfrastructureLogger"]>;
export type IncomingMessage = import("http").IncomingMessage;
export type ServerResponse = import("http").ServerResponse;
export type ExpressRequest = import("express").Request;
export type ExpressResponse = import("express").Response;
export type TODO = any;
export type Request = IncomingMessage | ExpressRequest;
export type Response = (ServerResponse | ExpressResponse) & {
  locals?: {
    webpack?: {
      devMiddleware?: Context;
    };
  };
};
export type Next = (err?: any) => void;
export type WatchOptions = NonNullable<Configuration["watchOptions"]>;
export type Watching = Compiler["watching"];
export type MultiWatching = ReturnType<Compiler["watch"]>;
export type OutputFileSystem = Compiler["outputFileSystem"] & {
  createReadStream?: typeof import("fs").createReadStream;
  statSync?: import("fs").StatSyncFn;
  lstat?: typeof import("fs").lstat;
  readFileSync?: typeof import("fs").readFileSync;
};
export type Context = {
  state: boolean;
  stats: Stats | MultiStats | undefined;
  callbacks: Function[];
  options: Options;
  compiler: Compiler | MultiCompiler;
  watching: Watching | MultiWatching;
  logger: Logger;
  outputFileSystem: OutputFileSystem;
};
export type Headers =
  | Record<string, string | number>
  | {
      key: string;
      value: number | string;
    }[]
  | ((
      req: Request,
      res: Response,
      context: Context
    ) => Record<string, number | string>);
export type Options = {
  mimeTypes?:
    | {
        [key: string]: string;
      }
    | undefined;
  writeToDisk?: boolean | TODO;
  methods?: string | undefined;
  headers?: Headers | undefined;
  publicPath?: NonNullable<Configuration["output"]>["publicPath"];
  stats?: Configuration["stats"];
  serverSideRender?: boolean | undefined;
  outputFileSystem?: OutputFileSystem | undefined;
  index?: string | boolean | undefined;
};
export type Middleware = (req: Request, res: Response, next: Next) => any;
export type AdditionalMethods = {
  getFilenameFromUrl: TODO;
  waitUntilValid: TODO;
  invalidate: TODO;
  close: TODO;
  context: Context;
};
export type API = Middleware & AdditionalMethods;
