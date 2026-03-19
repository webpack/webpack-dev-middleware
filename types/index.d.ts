export = wdm;
/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @param {Compiler | MultiCompiler} compiler compiler
 * @param {Options<RequestInternal, ResponseInternal>=} options options
 * @param {boolean} isPlugin true when will use as a plugin, otherwise false
 * @returns {API<RequestInternal, ResponseInternal>} webpack dev middleware
 */
declare function wdm<
  RequestInternal extends IncomingMessage = import("http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
>(
  compiler: Compiler | MultiCompiler,
  options?: Options<RequestInternal, ResponseInternal> | undefined,
  isPlugin?: boolean,
): API<RequestInternal, ResponseInternal>;
declare namespace wdm {
  export {
    hapiWrapper,
    koaWrapper,
    honoWrapper,
    Schema,
    Compiler,
    MultiCompiler,
    Configuration,
    Stats,
    MultiStats,
    ReadStream,
    FilenameWithExtra,
    EXPECTED_ANY,
    EXPECTED_FUNCTION,
    ExtendedServerResponse,
    IncomingMessage,
    ServerResponse,
    NextFunction,
    WatchOptions,
    Watching,
    MultiWatching,
    OutputFileSystem,
    Logger,
    Callback,
    ResponseData,
    ModifyResponseData,
    Context,
    FilledContext,
    NormalizedHeaders,
    Headers,
    Options,
    Middleware,
    GetFilenameFromUrl,
    WaitUntilValid,
    Invalidate,
    Close,
    AdditionalMethods,
    API,
    WithOptional,
    WithoutUndefined,
    StatsOptions,
    MultiStatsOptions,
    StatsObjectOptions,
    HapiPluginBase,
    HapiPlugin,
    HapiOptions,
  };
}
/**
 * @template S
 * @template O
 * @typedef {object} HapiPluginBase
 * @property {(server: S, options: O) => void | Promise<void>} register register
 */
/**
 * @template S
 * @template O
 * @typedef {HapiPluginBase<S, O> & { pkg: { name: string }, multiple: boolean }} HapiPlugin
 */
/**
 * @typedef {Options & { compiler: Compiler | MultiCompiler }} HapiOptions
 */
/**
 * @template HapiServer
 * @template {HapiOptions} HapiOptionsInternal
 * @param {boolean=} usePlugin true when need to use as a plugin, otherwise false
 * @returns {HapiPlugin<HapiServer, HapiOptionsInternal>} hapi wrapper
 */
declare function hapiWrapper<
  HapiServer,
  HapiOptionsInternal extends HapiOptions,
>(usePlugin?: boolean | undefined): HapiPlugin<HapiServer, HapiOptionsInternal>;
/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @param {Compiler | MultiCompiler} compiler compiler
 * @param {Options<RequestInternal, ResponseInternal>=} options options
 * @param {boolean=} usePlugin whether to use as webpack plugin
 * @returns {(ctx: EXPECTED_ANY, next: EXPECTED_FUNCTION) => Promise<void> | void} kow wrapper
 */
declare function koaWrapper<
  RequestInternal extends IncomingMessage = import("http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
>(
  compiler: Compiler | MultiCompiler,
  options?: Options<RequestInternal, ResponseInternal> | undefined,
  usePlugin?: boolean | undefined,
): (ctx: EXPECTED_ANY, next: EXPECTED_FUNCTION) => Promise<void> | void;
/**
 * @template {IncomingMessage} [RequestInternal=IncomingMessage]
 * @template {ServerResponse} [ResponseInternal=ServerResponse]
 * @param {Compiler | MultiCompiler} compiler compiler
 * @param {Options<RequestInternal, ResponseInternal>=} options options
 * @param {boolean=} usePlugin true when need to use as a plugin, otherwise false
 * @returns {(ctx: EXPECTED_ANY, next: EXPECTED_FUNCTION) => Promise<void> | void} hono wrapper
 */
declare function honoWrapper<
  RequestInternal extends IncomingMessage = import("http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
>(
  compiler: Compiler | MultiCompiler,
  options?: Options<RequestInternal, ResponseInternal> | undefined,
  usePlugin?: boolean | undefined,
): (ctx: EXPECTED_ANY, next: EXPECTED_FUNCTION) => Promise<void> | void;
type Schema = import("schema-utils/declarations/validate").Schema;
type Compiler = import("webpack").Compiler;
type MultiCompiler = import("webpack").MultiCompiler;
type Configuration = import("webpack").Configuration;
type Stats = import("webpack").Stats;
type MultiStats = import("webpack").MultiStats;
type ReadStream = import("fs").ReadStream;
type FilenameWithExtra = import("./middleware").FilenameWithExtra;
type EXPECTED_ANY = any;
type EXPECTED_FUNCTION = Function;
type ExtendedServerResponse = {
  /**
   * locals
   */
  locals?:
    | {
        webpack?: {
          devMiddleware?: Context<IncomingMessage, ServerResponse>;
        };
      }
    | undefined;
};
type IncomingMessage = import("http").IncomingMessage;
type ServerResponse = import("http").ServerResponse & ExtendedServerResponse;
type NextFunction = (err?: EXPECTED_ANY | undefined) => void;
type WatchOptions = NonNullable<Configuration["watchOptions"]>;
type Watching = Compiler["watching"];
type MultiWatching = ReturnType<MultiCompiler["watch"]>;
type OutputFileSystem = import("webpack").OutputFileSystem & {
  createReadStream?: typeof fs.createReadStream;
  statSync: fs.StatSyncFn;
  readFileSync: typeof fs.readFileSync;
};
type Logger = ReturnType<Compiler["getInfrastructureLogger"]>;
type Callback = (stats?: (Stats | MultiStats) | undefined) => any;
type ResponseData = {
  /**
   * data
   */
  data: Buffer | ReadStream;
  /**
   * byte length
   */
  byteLength: number;
};
type ModifyResponseData<
  RequestInternal extends IncomingMessage = import("http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> = (
  req: RequestInternal,
  res: ResponseInternal,
  data: Buffer | ReadStream,
  byteLength: number,
) => ResponseData;
type Context<
  RequestInternal extends IncomingMessage = import("http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> = {
  /**
   * state
   */
  state: boolean;
  /**
   * stats
   */
  stats: Stats | MultiStats | undefined;
  /**
   * callbacks
   */
  callbacks: Callback[];
  /**
   * options
   */
  options: Options<RequestInternal, ResponseInternal>;
  /**
   * compiler
   */
  compiler: Compiler | MultiCompiler;
  /**
   * watching
   */
  watching: Watching | MultiWatching;
  /**
   * logger
   */
  logger: Logger;
  /**
   * output file system
   */
  outputFileSystem: OutputFileSystem;
};
type FilledContext<
  RequestInternal extends IncomingMessage = import("http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> = WithoutUndefined<Context<RequestInternal, ResponseInternal>, "watching">;
type NormalizedHeaders =
  | Record<string, string | number>
  | {
      key: string;
      value: number | string;
    }[];
type Headers<
  RequestInternal extends IncomingMessage = import("http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> =
  | NormalizedHeaders
  | ((
      req: RequestInternal,
      res: ResponseInternal,
      context: Context<RequestInternal, ResponseInternal>,
    ) => void | undefined | NormalizedHeaders)
  | undefined;
type Options<
  RequestInternal extends IncomingMessage = import("http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> = {
  /**
   * mime types
   */
  mimeTypes?:
    | {
        [key: string]: string;
      }
    | undefined;
  /**
   * mime type default
   */
  mimeTypeDefault?: (string | undefined) | undefined;
  /**
   * write to disk
   */
  writeToDisk?: (boolean | ((targetPath: string) => boolean)) | undefined;
  /**
   * methods
   */
  methods?: string[] | undefined;
  /**
   * headers
   */
  headers?: Headers<RequestInternal, ResponseInternal> | undefined;
  /**
   * public path
   */
  publicPath?: NonNullable<Configuration["output"]>["publicPath"] | undefined;
  /**
   * stats
   */
  stats?: Configuration["stats"] | undefined;
  /**
   * is server side render
   */
  serverSideRender?: boolean | undefined;
  /**
   * output file system
   */
  outputFileSystem?: OutputFileSystem | undefined;
  /**
   * index
   */
  index?: (boolean | string) | undefined;
  /**
   * modify response data
   */
  modifyResponseData?:
    | ModifyResponseData<RequestInternal, ResponseInternal>
    | undefined;
  /**
   * options to generate etag header
   */
  etag?: ("weak" | "strong") | undefined;
  /**
   * options to generate last modified header
   */
  lastModified?: boolean | undefined;
  /**
   * options to generate cache headers
   */
  cacheControl?:
    | (
        | boolean
        | number
        | string
        | {
            maxAge?: number;
            immutable?: boolean;
          }
      )
    | undefined;
  /**
   * is cache immutable
   */
  cacheImmutable?: boolean | undefined;
  /**
   * forward error to next middleware
   */
  forwardError?: boolean | undefined;
};
type Middleware<
  RequestInternal extends IncomingMessage = import("http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> = (
  req: RequestInternal,
  res: ResponseInternal,
  next: NextFunction,
) => Promise<void>;
type GetFilenameFromUrl = (
  url: string,
) => Promise<FilenameWithExtra | undefined>;
type WaitUntilValid = (callback: Callback) => any;
type Invalidate = (callback: Callback) => any;
type Close = (callback: (err: Error | null | undefined) => void) => any;
type AdditionalMethods<
  RequestInternal extends IncomingMessage,
  ResponseInternal extends ServerResponse,
> = {
  /**
   * get filename from url
   */
  getFilenameFromUrl: GetFilenameFromUrl;
  /**
   * wait until valid
   */
  waitUntilValid: WaitUntilValid;
  /**
   * invalidate
   */
  invalidate: Invalidate;
  /**
   * close
   */
  close: Close;
  /**
   * context
   */
  context: Context<RequestInternal, ResponseInternal>;
};
type API<
  RequestInternal extends IncomingMessage = import("http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> = Middleware<RequestInternal, ResponseInternal> &
  AdditionalMethods<RequestInternal, ResponseInternal>;
type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<T>;
type WithoutUndefined<T, K extends keyof T> = T & {
  [P in K]: NonNullable<T[P]>;
};
type StatsOptions = Configuration["stats"];
type MultiStatsOptions = {
  children: Configuration["stats"][];
};
type StatsObjectOptions = Exclude<
  Configuration["stats"],
  boolean | string | undefined
>;
type HapiPluginBase<S, O> = {
  /**
   * register
   */
  register: (server: S, options: O) => void | Promise<void>;
};
type HapiPlugin<S, O> = HapiPluginBase<S, O> & {
  pkg: {
    name: string;
  };
  multiple: boolean;
};
type HapiOptions = Options & {
  compiler: Compiler | MultiCompiler;
};
import fs = require("node:fs");
