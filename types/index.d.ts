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
  RequestInternal extends IncomingMessage = import("node:http").IncomingMessage,
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
    HotOptions,
    HotInstance,
    MimeTypes,
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
    CacheOptions,
    NormalizedOptions,
    MimeOptions,
    Options,
    Middleware,
    GetFilenameFromUrl,
    WaitUntilValid,
    Invalidate,
    Attach,
    HandleUpgrade,
    Publish,
    PublishTo,
    OnConnect,
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
  RequestInternal extends IncomingMessage = import("node:http").IncomingMessage,
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
  RequestInternal extends IncomingMessage = import("node:http").IncomingMessage,
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
type HotOptions = import("./hot").HotOptions;
type HotInstance = import("./hot").HotInstance;
type MimeTypes = import("./utils").MimeTypes;
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
  statSync: typeof fs.statSync;
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
  RequestInternal extends IncomingMessage = import("node:http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> = (
  req: RequestInternal,
  res: ResponseInternal,
  data: Buffer | ReadStream,
  byteLength: number,
) => ResponseData;
type Context<
  RequestInternal extends IncomingMessage = import("node:http").IncomingMessage,
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
   * options, with `cache` and `mime` filled in
   */
  options: NormalizedOptions<RequestInternal, ResponseInternal>;
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
  /**
   * hot module replacement instance
   */
  hot?: HotInstance | undefined;
  /**
   * extension to media type, for this instance
   */
  mimeTypes: MimeTypes;
};
type FilledContext<
  RequestInternal extends IncomingMessage = import("node:http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> = WithoutUndefined<Context<RequestInternal, ResponseInternal>, "watching">;
type NormalizedHeaders =
  | Record<string, string | number>
  | {
      key: string;
      value: number | string;
    }[];
type Headers<
  RequestInternal extends IncomingMessage = import("node:http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> =
  | NormalizedHeaders
  | ((
      req: RequestInternal,
      res: ResponseInternal,
      context: Context<RequestInternal, ResponseInternal>,
    ) => void | undefined | NormalizedHeaders)
  | undefined;
type CacheOptions = {
  /**
   * generate an `ETag` header, weak or strong
   */
  etag?: ("weak" | "strong") | undefined;
  /**
   * generate a `Last-Modified` header from the file system's value
   */
  lastModified?: boolean | undefined;
  /**
   * set a `Cache-Control` header
   */
  control?:
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
   * send `Cache-Control: public, max-age=31536000, immutable` for an asset with a hash in its name
   */
  immutable?: boolean | undefined;
};
/**
 * The options as everything below the entry point sees them: the legacy flat
 * spellings have been folded in, so `cache` and `mime` are always objects.
 */
type NormalizedOptions<
  RequestInternal extends IncomingMessage = import("node:http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> = Options<RequestInternal, ResponseInternal> & {
  cache: CacheOptions;
  mime: MimeOptions;
};
type MimeOptions = {
  /**
   * register custom media types or extension mappings
   */
  types?:
    | {
        [key: string]: string;
      }
    | undefined;
  /**
   * the media type to fall back on when the content type cannot be determined
   */
  default?: string | undefined;
};
type Options<
  RequestInternal extends IncomingMessage = import("node:http").IncomingMessage,
  ResponseInternal extends ServerResponse = ServerResponse,
> = {
  /**
   * how responses are cached
   */
  cache?: CacheOptions | undefined;
  /**
   * how a file's media type is decided
   */
  mime?: MimeOptions | undefined;
  /**
   * deprecated, use `mime.types`
   */
  mimeTypes?:
    | {
        [key: string]: string;
      }
    | undefined;
  /**
   * deprecated, use `mime.default`
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
    ModifyResponseData<RequestInternal, ResponseInternal> | undefined;
  /**
   * deprecated, use `cache.etag`
   */
  etag?: ("weak" | "strong") | undefined;
  /**
   * deprecated, use `cache.lastModified`
   */
  lastModified?: boolean | undefined;
  /**
   * deprecated, use `cache.control`
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
   * deprecated, use `cache.immutable`
   */
  cacheImmutable?: boolean | undefined;
  /**
   * forward error to next middleware
   */
  forwardError?: boolean | undefined;
  /**
   * enable hot module replacement
   */
  hot?: (boolean | HotOptions) | undefined;
};
type Middleware<
  RequestInternal extends IncomingMessage = import("node:http").IncomingMessage,
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
type Attach = (server: import("node:http").Server) => any;
type HandleUpgrade = (
  req: IncomingMessage,
  socket: import("node:stream").Duplex,
  head: Buffer,
) => boolean;
type Publish = (
  payload: import("./hot").Payload | import("./hot").CustomPayload,
) => any;
type PublishTo = (
  client: EXPECTED_ANY,
  payload:
    | import("./hot").Payload
    | {
        action: string;
      },
) => any;
type OnConnect = (
  fn: (client: EXPECTED_ANY, req: IncomingMessage) => void,
) => any;
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
   * answer WebSocket upgrades on this server
   */
  attach: Attach;
  /**
   * answer one WebSocket upgrade, for a server that owns its own `upgrade` event
   */
  handleUpgrade: HandleUpgrade;
  /**
   * called with each client that joins, and the request it joined with
   */
  onConnect: OnConnect;
  /**
   * put a payload of your own on the hot stream, for what a server measures itself — a no-op when `hot` is off
   */
  publish: Publish;
  /**
   * put a payload on the hot stream for one client, for answering a single connection — whichever transport is carrying it, and a no-op when `hot` is off
   */
  publishTo: PublishTo;
  /**
   * the secret the hot endpoint requires, for a client of your own to put on the url; false when it requires none, undefined when `hot` is off
   */
  token?: (string | false | undefined) | undefined;
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
  RequestInternal extends IncomingMessage = import("node:http").IncomingMessage,
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
