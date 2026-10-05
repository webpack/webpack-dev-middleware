export = createHot;
/**
 * @typedef {object} HotInstance
 * @property {string} path path the endpoint is served at
 * @property {("sse" | "ws" | ClientStreamFactory<EXPECTED_ANY>)} transport how events reach the clients
 * @property {string | false} token the secret the endpoint requires, or false when it requires none; the injected client is given it
 * @property {(server: HttpServer) => void} attach answer WebSocket upgrades on this server, a no-op for Server-Sent Events
 * @property {(req: IncomingMessage, socket: Duplex, head: Buffer) => boolean} handleUpgrade answer one WebSocket upgrade, for a caller that owns the server's `upgrade` event and wants to decide each one; returns false when the request is not the endpoint's, or the transport does not answer upgrades
 * @property {(fn: (client: EXPECTED_ANY, req: IncomingMessage) => void) => void} onConnect called with each client once it has joined, and the request it joined with, before anything is published to it
 * @property {(req: IncomingMessage, res: ServerResponse) => void} handle answer a request on the endpoint's path
 * @property {(payload: Payload | CustomPayload) => void} publish publish a payload to every client
 * @property {(client: EXPECTED_ANY, payload: Payload | CustomPayload) => void} publishTo publish a payload to one client, for answering a single connection
 * @property {() => void} close end every client and detach the heartbeat
 */
/**
 * @param {Compiler | MultiCompiler} compiler compiler
 * @param {HotOptions | true} userOptions options
 * @param {MiddlewareStatsOption=} statsOption the middleware's `stats` option, which decides whether a payload carries errors and warnings
 * @returns {HotInstance} hot instance
 */
declare function createHot(
  compiler: Compiler | MultiCompiler,
  userOptions: HotOptions | true,
  statsOption?: MiddlewareStatsOption | undefined,
): HotInstance;
declare namespace createHot {
  export {
    HOT_DEFAULT_HEARTBEAT,
    HOT_DEFAULT_PATH,
    HOT_DEFAULT_TRANSPORT,
    checkClientStream,
    createEventStream,
    createHot,
    formatErrors,
    publishBundles,
    toBundles,
    HotInstance,
    Compiler,
    MultiCompiler,
    Logger,
    Stats,
    MultiStats,
    StatsCompilation,
    StatsError,
    IncomingMessage,
    ServerResponse,
    HttpServer,
    Duplex,
    StatsOptions,
    MiddlewareStatsOption,
    HotClientOptions,
    HotOptions,
    CorsOrigin,
    CorsOption,
    Payload,
    CustomPayload,
    EXPECTED_ANY,
    WebSocketLikeClient,
    StreamClient,
    ClientStream,
    ClientStreamFactory,
    EventStream,
  };
}
declare const HOT_DEFAULT_HEARTBEAT: number;
declare const HOT_DEFAULT_PATH: "/__webpack_hmr";
declare const HOT_DEFAULT_TRANSPORT: "sse";
/**
 * @param {ClientStream<EXPECTED_ANY>} stream what a `transport` function returned
 * @returns {ClientStream<EXPECTED_ANY>} the same stream
 */
declare function checkClientStream(
  stream: ClientStream<EXPECTED_ANY>,
): ClientStream<EXPECTED_ANY>;
declare function createEventStream(
  heartbeat: number,
  logger: Logger,
  cors?: CorsOption | undefined,
  token?: (string | false) | undefined,
): EventStream;
/**
 * @param {(string | StatsError)[]} errors errors or warnings
 * @returns {string[]} flat strings
 */
declare function formatErrors(errors: (string | StatsError)[]): string[];
/**
 * Publish one event per bundle. Bundles whose hash did not change are
 * published as `sync`, so their clients do not fetch a hot-update manifest
 * that was never emitted.
 * @param {StatsCompilation[]} bundles bundles from the current build
 * @param {StatsCompilation[] | null} previousBundles bundles from the previous build (null on the first build, which publishes everything as `built`)
 * @param {EventStream} eventStream event stream
 */
declare function publishBundles(
  bundles: StatsCompilation[],
  previousBundles: StatsCompilation[] | null,
  eventStream: EventStream,
): void;
/**
 * @param {Stats | MultiStats} statsResult stats result
 * @param {StatsOptions | undefined} statsOptions deprecated `hot.statsOptions`
 * @param {MiddlewareStatsOption=} statsOption the middleware's `stats` option
 * @returns {StatsCompilation[]} normalized per-bundle stats
 */
declare function toBundles(
  statsResult: Stats | MultiStats,
  statsOptions: StatsOptions | undefined,
  statsOption?: MiddlewareStatsOption | undefined,
): StatsCompilation[];
type HotInstance = {
  /**
   * path the endpoint is served at
   */
  path: string;
  /**
   * how events reach the clients
   */
  transport: "sse" | "ws" | ClientStreamFactory<EXPECTED_ANY>;
  /**
   * the secret the endpoint requires, or false when it requires none; the injected client is given it
   */
  token: string | false;
  /**
   * answer WebSocket upgrades on this server, a no-op for Server-Sent Events
   */
  attach: (server: HttpServer) => void;
  /**
   * answer one WebSocket upgrade, for a caller that owns the server's `upgrade` event and wants to decide each one; returns false when the request is not the endpoint's, or the transport does not answer upgrades
   */
  handleUpgrade: (
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => boolean;
  /**
   * called with each client once it has joined, and the request it joined with, before anything is published to it
   */
  onConnect: (fn: (client: EXPECTED_ANY, req: IncomingMessage) => void) => void;
  /**
   * answer a request on the endpoint's path
   */
  handle: (req: IncomingMessage, res: ServerResponse) => void;
  /**
   * publish a payload to every client
   */
  publish: (payload: Payload | CustomPayload) => void;
  /**
   * publish a payload to one client, for answering a single connection
   */
  publishTo: (client: EXPECTED_ANY, payload: Payload | CustomPayload) => void;
  /**
   * end every client and detach the heartbeat
   */
  close: () => void;
};
type Compiler = import("webpack").Compiler;
type MultiCompiler = import("webpack").MultiCompiler;
type Logger = ReturnType<Compiler["getInfrastructureLogger"]>;
type Stats = import("webpack").Stats;
type MultiStats = import("webpack").MultiStats;
type StatsCompilation = import("webpack").StatsCompilation;
type StatsError = import("webpack").StatsError;
type IncomingMessage = import("./index.js").IncomingMessage;
type ServerResponse = import("./index.js").ServerResponse;
type HttpServer = import("node:http").Server;
type Duplex = import("node:stream").Duplex;
type StatsOptions = import("webpack").StatsOptions;
type MiddlewareStatsOption = import("webpack").Configuration["stats"];
/**
 * Everything the browser runtime reads, as it is set in node. One for one with
 * what the entry query carries, so every option has both spellings: set it
 * here and the injected entry carries it, or write it on the query of a client
 * entry of your own.
 *
 * `transport`, `path` and `name` are the exception only in having a default
 * the middleware knows — the resolved `hot.transport`, the resolved `hot.path`
 * and the compilation's name. Setting one here replaces that, which is what a
 * page reaching the endpoint through a proxy or another origin needs.
 */
type HotClientOptions = {
  /**
   * which transport the runtime speaks, `hot.transport` by default
   */
  transport?: ("sse" | "ws") | undefined;
  /**
   * where the runtime connects, `hot.path` by default; may be an absolute url for an endpoint on another origin
   */
  path?: string | undefined;
  /**
   * limit the runtime to one compilation's builds, the compilation's own name by default
   */
  name?: string | undefined;
  /**
   * the secret the runtime puts on its connection url, `hot.token` by default
   */
  token?: string | undefined;
  /**
   * show build problems and uncaught runtime errors in an overlay
   */
  overlay?: (boolean | Record<string, EXPECTED_ANY>) | undefined;
  /**
   * show an indicator while a rebuild is in progress
   */
  progress?: (boolean | "circular" | "linear") | undefined;
  /**
   * deprecated, removed in the next major release — use `apply`
   */
  hot?: boolean | undefined;
  /**
   * deprecated, removed in the next major release — use `apply`
   */
  liveReload?: boolean | undefined;
  /**
   * deprecated, removed in the next major release — use `apply`
   */
  reload?: boolean | undefined;
  /**
   * what a build does to the page — apply the update and reload if it cannot be applied, apply it and stop with a message if it cannot, load the page again on any build that changed something, or leave the page alone
   */
  apply?: ("hmr" | "hmr-only" | "reload" | "nothing") | undefined;
  /**
   * whether to connect when the entry runs, and how the connection is held open
   */
  connect?:
    | (
        | boolean
        | {
            retries?: number;
            timeout?: number;
          }
      )
    | undefined;
  /**
   * prefix of the page-url parameter that overrides `apply` for a single page
   */
  urlPrefix?: string | undefined;
  /**
   * how much the runtime logs to the browser console
   */
  logging?:
    ("none" | "error" | "warn" | "info" | "log" | "verbose") | undefined;
  /**
   * how many times to reconnect before giving up; unset, Server-Sent Events keep trying for as long as the page is open while a WebSocket gives up after 10
   */
  reconnect?: number | undefined;
  /**
   * how long the runtime tolerates silence before reconnecting, in milliseconds — Server-Sent Events only, since a WebSocket's heartbeat is a protocol ping JavaScript cannot see
   */
  timeout?: number | undefined;
  /**
   * connect as soon as the entry runs
   */
  autoConnect?: boolean | undefined;
  /**
   * prefix the path with the bundle's public path at runtime
   */
  dynamicPublicPath?: boolean | undefined;
};
type HotOptions = {
  /**
   * how events reach the clients, Server-Sent Events by default
   */
  transport?: ("sse" | "ws" | ClientStreamFactory<EXPECTED_ANY>) | undefined;
  /**
   * the path the endpoint is served at
   */
  path?: string | undefined;
  /**
   * heartbeat interval in milliseconds
   */
  heartbeat?: number | undefined;
  /**
   * HTTP server the `"ws"` transport answers upgrades on, when it is already built
   */
  server?: HttpServer | undefined;
  /**
   * deprecated, removed in the next major release — webpack stats options used when serializing compilation results
   */
  statsOptions?: StatsOptions | undefined;
  /**
   * publish compilation progress events to the clients
   */
  progress?: boolean | undefined;
  /**
   * which origins may reach the endpoint from a page on another one; the local ones by default
   */
  cors?: CorsOption | undefined;
  /**
   * a secret the injected client carries and the endpoint requires; `true` mints one per run, a string uses that one, `false` requires none. Defaults to `false` on both transports; `true` in the next major release
   */
  token?: (boolean | string) | undefined;
  /**
   * add the hot client entry and `HotModuleReplacementPlugin` to the compilation (default `true`); turn it off to wire them yourself
   */
  inject?: boolean | undefined;
  /**
   * options handed to the browser runtime through its entry query
   */
  client?: HotClientOptions | undefined;
};
/**
 * What an origin is matched against: one origin, several, a pattern, or a
 * question asked of each.
 */
type CorsOrigin =
  string | RegExp | (string | RegExp)[] | ((origin: string) => boolean);
/**
 * Which origins may read the event stream, as a CORS grant rather than a check:
 * a request is never refused, it is only told whether the browser may hand the
 * response to the page. `false` sends no grant, which leaves the browser's own
 * same-origin rule in place; `true` grants every origin; anything else is
 * matched against the request's own, which is echoed back when it is allowed.
 * `{ origin }` is accepted as well, so a `cors` written for Vite or
 * `expressjs/cors` reads the same here.
 */
type CorsOption =
  | boolean
  | CorsOrigin
  | {
      origin?: CorsOrigin | boolean;
    };
/**
 * What this middleware publishes. `action` is the only part the bundled client
 * reads for dispatch; the rest is what each action carries.
 */
type Payload = {
  /**
   * action
   */
  action: string;
  /**
   * file that invalidated the compilation
   */
  file?: string | undefined;
  /**
   * name
   */
  name?: string | undefined;
  /**
   * time
   */
  time?: number | undefined;
  /**
   * hash
   */
  hash?: string | undefined;
  /**
   * compilation progress (0-100)
   */
  percent?: number | undefined;
  /**
   * progress message
   */
  message?: string | undefined;
  /**
   * warnings
   */
  warnings?: string[] | undefined;
  /**
   * errors
   */
  errors?: string[] | undefined;
};
/**
 * A payload of someone else's, which `publish` exists to carry.
 *
 * Only `action` is required, since that is all a client needs to tell one
 * apart. Everything beyond it belongs to whoever is publishing — a server with
 * its own `ProgressPlugin` has more to say about a tick than `percent` and
 * `message`, and a `subscribe` handler of theirs is what reads it. Typing it
 * shut would make the published-payload shape this middleware's to approve,
 * which is the opposite of what this is for.
 */
type CustomPayload = {
  action: string;
} & Record<string, EXPECTED_ANY>;
type EXPECTED_ANY = any;
/**
 * The WebSocket members a client is published to through. Structural rather than
 * the ws package's own declarations, which would put an optional dependency's
 * types in the path of every consumer, including those on Server-Sent Events.
 */
type WebSocketLikeClient = {
  /**
   * the socket's current state
   */
  readyState: number;
  /**
   * the value `readyState` has while the socket is open
   */
  OPEN: number;
  /**
   * send a frame to this client
   */
  send: (data: string) => void;
};
/**
 * What a client is addressed by, which is whatever the transport handed out: the
 * response holding a Server-Sent Events stream, or a WebSocket.
 */
type StreamClient = ServerResponse | WebSocketLikeClient;
/**
 * One transport's clients. `createHot` publishes through this and does not know
 * whether the events leave over Server-Sent Events, a WebSocket or something of
 * your own, which is what `TClient` is for: a transport built by a `transport`
 * function names the type of the clients it hands to `onConnect` and takes back
 * in `publishTo`.
 */
type ClientStream<TClient extends unknown = StreamClient> = {
  /**
   * answer a request on the endpoint's path; without one a request there is answered `426 Upgrade Required`
   */
  handler?: ((req: IncomingMessage, res: ServerResponse) => void) | undefined;
  /**
   * true when at least one client is connected; without one a payload is built even if nobody is listening
   */
  hasClients?: (() => boolean) | undefined;
  /**
   * called with each client once it has joined, and the request it joined with
   */
  onConnect: (fn: (client: TClient, req: IncomingMessage) => void) => void;
  /**
   * publish a payload to every client
   */
  publish: (payload: Payload | CustomPayload) => void;
  /**
   * publish a payload to a single client
   */
  publishTo: (client: TClient, payload: Payload | CustomPayload) => void;
  /**
   * end every client and stop the heartbeat
   */
  close: () => void;
  /**
   * answer upgrades on this server
   */
  attach?: ((server: HttpServer) => void) | undefined;
  /**
   * stop answering upgrades
   */
  detach?: (() => void) | undefined;
  /**
   * answer one upgrade, for a caller that owns the server's `upgrade` event; returns false when the request is not this endpoint's
   */
  handleUpgrade?:
    | ((req: IncomingMessage, socket: Duplex, head: Buffer) => boolean)
    | undefined;
};
/**
 * Builds a transport of your own. The same calls `createHot` makes of the
 * built-in two are made of whatever this returns.
 */
type ClientStreamFactory<TClient extends unknown = StreamClient> = (
  options: {
    path: string;
    heartbeat: number;
    cors: CorsOption | undefined;
    token: string | false;
  },
  logger: Logger,
) => ClientStream<TClient>;
type EventStream = ClientStream;
