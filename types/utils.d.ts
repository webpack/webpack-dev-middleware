export type Stats = import("fs").Stats;
export type ReadStream = import("fs").ReadStream;
export type ExpectedIncomingMessage = {
  /**
   * get header extra method
   */
  getHeader?: ((name: string) => string | string[] | undefined) | undefined;
  /**
   * get method extra method
   */
  getMethod?: (() => string | undefined) | undefined;
  /**
   * get URL extra method
   */
  getURL?: (() => string | undefined) | undefined;
  /**
   * an extra option for `fastify` (and `@fastify/express`) to get original URL
   */
  originalUrl?: string | undefined;
  /**
   * an extra option for `fastify` (and `@fastify/express`) to get ID of request
   */
  id?: string | undefined;
};
export type ExpectedServerResponse = {
  /**
   * set status code
   */
  setStatusCode?: ((status: number) => void) | undefined;
  /**
   * get status code
   */
  getStatusCode?: (() => number) | undefined;
  /**
   * get header
   */
  getHeader: (name: string) => string | string[] | undefined | number;
  /**
   * set header
   */
  setHeader?:
    | ((
        name: string,
        value: number | string | Readonly<string[]>,
      ) => ExpectedServerResponse)
    | undefined;
  /**
   * remove header
   */
  removeHeader?: ((name: string) => void) | undefined;
  /**
   * send
   */
  send?: ((data: string | Buffer) => void) | undefined;
  /**
   * finish
   */
  finish?: ((data?: string | Buffer) => void) | undefined;
  /**
   * get response header
   */
  getResponseHeaders?: (() => string[]) | undefined;
  /**
   * get headers sent
   */
  getHeadersSent?: (() => boolean) | undefined;
  /**
   * stream
   */
  stream?: ((data: EXPECTED_ANY) => void) | undefined;
  /**
   * get outgoing
   */
  getOutgoing?: (() => EXPECTED_ANY) | undefined;
  /**
   * set state
   */
  setState?: ((name: string, value: EXPECTED_ANY) => void) | undefined;
};
/**
 * The resolved answer to "may this origin read the stream": no origin may, any
 * origin may, or ask this.
 */
export type CorsGrant = false | "*" | ((origin: string) => boolean);
export type MimeTypes = {
  /**
   * the media type an extension, a `.extension`, or a path resolves to
   */
  lookup: (file: string) => string | false;
  /**
   * the charset a media type is served as
   */
  charset: (type: string) => string | false;
  /**
   * a `Content-Type` value for a media type or an extension
   */
  contentType: (str: string) => string | false;
};
export type Compiler = import("webpack").Compiler;
export type HotOptions = import("./hot.js").HotOptions;
export type HotClientOptions = import("./hot.js").HotClientOptions;
export type IncomingMessage = import("./index").IncomingMessage;
export type ServerResponse = import("./index").ServerResponse;
export type OutputFileSystem = import("./index").OutputFileSystem;
export type EXPECTED_ANY = import("./index").EXPECTED_ANY;
export type Logger = import("./index").Logger;
export type FunctionReturning<T> = (...args: EXPECTED_ANY) => T;
export type CorsOption = import("./hot.js").CorsOption;
export type CorsOrigin = import("./hot.js").CorsOrigin;
export type MimeDbEntry = {
  source?: string;
  charset?: string;
  compressible?: boolean;
  extensions?: readonly string[];
};
/** @typedef {import("./hot.js").CorsOption} CorsOption */
/** @typedef {import("./hot.js").CorsOrigin} CorsOrigin */
export const CORS_LOCAL_ORIGINS: RegExp;
export const HOT_DEFAULT_TOKEN: false;
/**
 * Add the cross-origin grant the `cors` option asks for, if any.
 *
 * Without a grant the browser will not hand a cross-origin `EventSource`
 * response to the page, which is what keeps a build's errors — module paths and
 * the source frames webpack puts in a parse error — from being readable by any
 * site the developer happens to have open. Nothing is rejected: the request is
 * answered either way, and the browser decides what to do with it.
 *
 * No same-origin case to handle here, unlike an upgrade: a browser sends no
 * `Origin` at all for a same-origin `EventSource`, and would not consult these
 * headers if it did.
 * @param {CorsGrant} grant the resolved grant
 * @param {IncomingMessage} req the request joining the stream
 * @param {Record<string, string>} headers the response headers, added to in place
 */
export function applyCors(
  grant: CorsGrant,
  req: IncomingMessage,
  headers: Record<string, string>,
): void;
/**
 * The browser options, as the client reads them from its resource query.
 * @param {EXPECTED_ANY} client the `hot.client` option
 * @param {string=} resolvedPath the path the endpoint is served at
 * @returns {Record<string, string>} query parameters
 */
export function clientQuery(
  client: EXPECTED_ANY,
  resolvedPath?: string | undefined,
): Record<string, string>;
/**
 * @typedef {object} MimeTypes
 * @property {(file: string) => string | false} lookup the media type an extension, a `.extension`, or a path resolves to
 * @property {(type: string) => string | false} charset the charset a media type is served as
 * @property {(str: string) => string | false} contentType a `Content-Type` value for a media type or an extension
 */
/**
 * The lookup an instance uses, with the `mimeTypes` option over the top of the
 * known extensions rather than written into them.
 * @param {Record<string, string>=} extra extension to media type, from the `mimeTypes` option
 * @returns {MimeTypes} the lookup
 */
export function createMimeTypes(
  extra?: Record<string, string> | undefined,
): MimeTypes;
/**
 * @param {object} options options
 * @param {string} options.filename filename
 * @param {OutputFileSystem} options.outputFileSystem output file system
 * @param {import("range-parser").Range[]} options.ranges ranges
 * @param {number} options.size size
 * @param {string | false} options.contentType content type
 * @returns {{ boundary: string, byteLength: number, bufferOrStream: Readable }} result
 */
export function createMultipartBody({
  filename,
  outputFileSystem,
  ranges,
  size,
  contentType,
}: {
  filename: string;
  outputFileSystem: OutputFileSystem;
  ranges: import("range-parser").Range[];
  size: number;
  contentType: string | false;
}): {
  boundary: string;
  byteLength: number;
  bufferOrStream: Readable;
};
/**
 * @param {string} filename filename
 * @param {OutputFileSystem} outputFileSystem output file system
 * @param {number} start start
 * @param {number} end end
 * @returns {{ bufferOrStream: (Buffer | import("fs").ReadStream), byteLength: number }} result with buffer or stream and byte length
 */
export function createReadStreamOrReadFile(
  filename: string,
  outputFileSystem: OutputFileSystem,
  start: number,
  end: number,
): {
  bufferOrStream: Buffer | import("fs").ReadStream;
  byteLength: number;
};
/**
 * @param {import("fs").ReadStream} stream stream
 * @param {boolean} suppress do need suppress?
 * @returns {void}
 */
export function destroyStream(
  stream: import("fs").ReadStream,
  suppress: boolean,
): void;
/**
 * @param {string} string raw HTML
 * @returns {string} escaped HTML
 */
export function escapeHtml(string: string): string;
/**
 * Create a simple ETag.
 * @param {Buffer | ReadStream | Stats} entity entity
 * @returns {Promise<{ hash: string, buffer?: Buffer }>} etag
 */
export function etag(entity: Buffer | ReadStream | Stats): Promise<{
  hash: string;
  buffer?: Buffer;
}>;
/**
 * A filter as source the client can rebuild from.
 *
 * An arrow function and a `function` both stringify to something that can be
 * assigned; a method shorthand — `overlay: { errors(message) {} }` — does not,
 * and would have gone over as `errors(message) {}` for the client to choke on.
 * Making it a function expression is the whole of the difference.
 * @param {string} option which filter it is, for the error
 * @param {EXPECTED_ANY} filter the function given
 * @returns {string} source the client can assign
 */
export function filterSource(option: string, filter: EXPECTED_ANY): string;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {(string | Buffer)=} data data
 */
export function finish<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response, data?: (string | Buffer) | undefined): void;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @returns {boolean} true when headers were sent, otherwise false
 */
export function getHeadersSent<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response): boolean;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @returns {Response} res res
 */
export function getOutgoing<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response): Response;
/**
 * @typedef {object} ExpectedIncomingMessage
 * @property {((name: string) => string | string[] | undefined)=} getHeader get header extra method
 * @property {(() => string | undefined)=} getMethod get method extra method
 * @property {(() => string | undefined)=} getURL get URL extra method
 * @property {string=} originalUrl an extra option for `fastify` (and `@fastify/express`) to get original URL
 * @property {string=} id an extra option for `fastify` (and `@fastify/express`) to get ID of request
 */
/**
 * @typedef {object} ExpectedServerResponse
 * @property {((status: number) => void)=} setStatusCode set status code
 * @property {(() => number)=} getStatusCode get status code
 * @property {((name: string) => string | string[] | undefined | number)} getHeader get header
 * @property {((name: string, value: number | string | Readonly<string[]>) => ExpectedServerResponse)=} setHeader set header
 * @property {((name: string) => void)=} removeHeader remove header
 * @property {((data: string | Buffer) => void)=} send send
 * @property {((data?: string | Buffer) => void)=} finish finish
 * @property {(() => string[])=} getResponseHeaders get response header
 * @property {(() => boolean)=} getHeadersSent get headers sent
 * @property {((data: EXPECTED_ANY) => void)=} stream stream
 * @property {(() => EXPECTED_ANY)=} getOutgoing get outgoing
 * @property {((name: string, value: EXPECTED_ANY) => void)=} setState set state
 */
/**
 * @template {IncomingMessage & ExpectedIncomingMessage} Request
 * @param {Request} req req
 * @param {string} name name
 * @returns {string | string[] | undefined} request header
 */
export function getRequestHeader<
  Request extends IncomingMessage & ExpectedIncomingMessage,
>(req: Request, name: string): string | string[] | undefined;
/**
 * @template {IncomingMessage & ExpectedIncomingMessage} Request
 * @param {Request} req req
 * @returns {string | undefined} request method
 */
export function getRequestMethod<
  Request extends IncomingMessage & ExpectedIncomingMessage,
>(req: Request): string | undefined;
/**
 * @template {IncomingMessage & ExpectedIncomingMessage} Request
 * @param {Request} req req
 * @returns {string | undefined} request URL
 */
export function getRequestURL<
  Request extends IncomingMessage & ExpectedIncomingMessage,
>(req: Request): string | undefined;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {string} name name
 * @returns {string | string[] | undefined | number} header
 */
export function getResponseHeader<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response, name: string): string | string[] | undefined | number;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @returns {string[]} header names
 */
export function getResponseHeaders<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response): string[];
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @returns {number} status code
 */
export function getStatusCode<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response): number;
/**
 * @param {"bytes"} type type
 * @param {number} size size
 * @param {import("range-parser").Range=} range range
 * @returns {string} value of content range header
 */
export function getValueContentRangeHeader(
  type: "bytes",
  size: number,
  range?: import("range-parser").Range | undefined,
): string;
/**
 * Whether every entry point already pulls the client in.
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when nothing needs adding
 */
export function hasClientEntry(compiler: Compiler): boolean;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 */
export function initState<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response): void;
/**
 * Put the hot runtime into the compilation, so enabling `hot` is the whole of
 * what a developer has to do: no entry to add, no `HotModuleReplacementPlugin`
 * to remember, no configuration to change.
 *
 * The client is given the endpoint, the transport and the browser options
 * through its resource query, so it agrees with the server by construction
 * rather than by the developer keeping two settings in step.
 */
/**
 * @param {Compiler[]} compilers compilers to modify
 * @param {{ path: string, transport: NonNullable<HotOptions["transport"]>, inject?: boolean, client?: HotClientOptions | false, token?: string | false }} options resolved hot options
 * @param {Logger} logger logger
 */
export function injectHotClient(
  compilers: Compiler[],
  options: {
    path: string;
    transport: NonNullable<HotOptions["transport"]>;
    inject?: boolean;
    client?: HotClientOptions | false;
    token?: string | false;
  },
  logger: Logger,
): void;
/**
 * Is this request's origin the one it was sent to?
 *
 * The middleware never knows the url it is mounted under, so its own origin is
 * only ever readable from the request: whatever answered is whatever the client
 * addressed. Both sides carry the port when it is not the scheme's default, so
 * they are compared as they arrived.
 * @param {IncomingMessage} req the request
 * @param {string} origin the `Origin` it carried
 * @returns {boolean} true when the two are the same origin
 */
export function isSameOrigin(req: IncomingMessage, origin: string): boolean;
/**
 * Does the request carry the token the endpoint requires?
 *
 * Compared in constant time. The comparison is not a plausible oracle — a
 * token lives for one run of one dev server — but a length-dependent early
 * return would be the kind of thing a reader has to reason about, and
 * `timingSafeEqual` costs nothing here.
 * @param {string | false} expected the resolved token, or false when none is required
 * @param {IncomingMessage} req the request
 * @returns {boolean} true when the request may proceed
 */
export function isTokenValid(
  expected: string | false,
  req: IncomingMessage,
): boolean;
/**
 * May this WebSocket handshake go ahead?
 *
 * A handshake is not subject to CORS — a browser sends `Origin` and pays no
 * attention to what comes back — so the same option can only be honoured here
 * by refusing the upgrade. Two cases are allowed whatever the option says,
 * because neither is a page on another origin reading the stream.
 *
 * A request with no `Origin` at all is not a browser: browsers always send one
 * on a handshake, while a Node client, a proxy's health check or a test
 * harness does not, and refusing those would break them for nothing.
 *
 * A request whose `Origin` is the one it was addressed to is the page the
 * middleware is serving. `EventSource` gets this for free, since the browser
 * knows a same-origin read needs no grant; an upgrade has to work it out.
 * @param {CorsGrant} grant the resolved grant
 * @param {IncomingMessage} req the request being upgraded
 * @returns {boolean} true when the upgrade may proceed
 */
export function isUpgradeAllowed(
  grant: CorsGrant,
  req: IncomingMessage,
): boolean;
/**
 * Whether a compiler produces something a browser will run, which is the whole
 * of what decides where the client goes.
 *
 * `platform` answers it for every target webpack resolves one from: `web` is
 * true for `web`, `webworker`, `electron-renderer`, `electron-preload`, `nwjs`,
 * `deno` and a browserslist query, and false for `node`, `async-node`,
 * `electron-main` and a `nodeXX` version. A target that names no platform at
 * all — `target: false`, or a bare `es2020` — leaves nothing to go on and gets
 * no client; add the entry yourself there.
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when the client belongs in this compilation
 */
export function isWebTarget(compiler: Compiler): boolean;
/**
 * The resolved answer to "may this origin read the stream": no origin may, any
 * origin may, or ask this.
 * @typedef {false | "*" | ((origin: string) => boolean)} CorsGrant
 */
/**
 * Does one origin match what the `cors` option allows?
 * @param {string} origin the origin the request carried
 * @param {CorsOrigin} allowed what the option allows
 * @returns {boolean} true when the origin is allowed
 */
export function matchOrigin(origin: string, allowed: CorsOrigin): boolean;
/**
 * @template T
 * @param {FunctionReturning<T>} fn memorized function
 * @param {({ cache?: Map<string, { data: T }>, maxSize?: number } | undefined)=} cache cache
 * @param {((value: T) => T)=} callback callback
 * @returns {FunctionReturning<T>} new function
 * @throws {TypeError} when `maxSize` is not a positive integer
 */
export function memorize<T>(
  fn: FunctionReturning<T>,
  {
    cache,
    maxSize,
  }?:
    | (
        | {
            cache?: Map<
              string,
              {
                data: T;
              }
            >;
            maxSize?: number;
          }
        | undefined
      )
    | undefined,
  callback?: ((value: T) => T) | undefined,
): FunctionReturning<T>;
/**
 * How official a media type is. The higher the score the more it is preferred
 * where two types claim the same extension.
 * @param {string} mimeType the media type
 * @param {string=} source where `mime-db` got it from
 * @returns {number} the score
 */
export function mimeScore(
  mimeType: string,
  source?: string | undefined,
): number;
/**
 * @param {import("fs").ReadStream} stream node readable stream
 * @returns {ReadableStream<Uint8Array>} web readable stream
 */
export function nodeReadableToWebStream(
  stream: import("fs").ReadStream,
): ReadableStream<Uint8Array>;
/** @typedef {import("fs").Stats} Stats */
/** @typedef {import("fs").ReadStream} ReadStream */
/**
 * Parse an HTTP Date into a number.
 * @param {string} date date
 * @returns {number} timestamp
 */
export function parseHttpDate(date: string): number;
/**
 * Parse a HTTP token list.
 * @param {string} str str
 * @returns {string[]} tokens
 */
export function parseTokenList(str: string): string[];
/**
 * Does a url's pathname match an expected path exactly?
 *
 * Pathname only: the hot endpoint is reached with a query on it — the client's
 * options, and the token — and with a fragment from a page that has one.
 * @param {string | undefined} url url
 * @param {string} expected expected pathname
 * @returns {boolean} true when the url pathname matches the expected path
 */
export function pathMatch(url: string | undefined, expected: string): boolean;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {import("fs").ReadStream} bufferOrStream buffer or stream
 */
export function pipe<Response extends ServerResponse & ExpectedServerResponse>(
  res: Response,
  bufferOrStream: import("fs").ReadStream,
): void;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {string} name name
 * @returns {void}
 */
export function removeResponseHeader<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response, name: string): void;
/**
 * Read the `cors` option once, so each request costs a call rather than a walk
 * back through every form the option can take.
 * @param {CorsOption} cors the option, as it was given, or the transport's default when it was not
 * @returns {CorsGrant} the resolved answer
 */
export function resolveCors(cors: CorsOption): CorsGrant;
/**
 * The token the endpoint will require, if any.
 * @param {boolean | string | undefined} option the `hot.token` option
 * @returns {string | false} the token, or false when the endpoint requires none
 */
export function resolveToken(
  option: boolean | string | undefined,
): string | false;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {string | Buffer} bufferOrString buffer or string
 * @returns {void}
 */
export function send<Response extends ServerResponse & ExpectedServerResponse>(
  res: Response,
  bufferOrString: string | Buffer,
): void;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {string} name name
 * @param {number | string | Readonly<string[]>} value value
 * @returns {Response} response
 */
export function setResponseHeader<
  Response extends ServerResponse & ExpectedServerResponse,
>(
  res: Response,
  name: string,
  value: number | string | Readonly<string[]>,
): Response;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {string} name name
 * @param {EXPECTED_ANY} value state
 * @returns {void}
 */
export function setState<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response, name: string, value: EXPECTED_ANY): void;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {number} code code
 * @returns {void}
 */
export function setStatusCode<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response, code: number): void;
import { Readable } from "node:stream";
