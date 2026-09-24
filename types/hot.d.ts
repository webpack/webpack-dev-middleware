export = createHot;
/**
 * @typedef {object} HotInstance
 * @property {string} path path the endpoint is served at
 * @property {("sse" | "ws" | ClientStreamFactory<EXPECTED_ANY>)} transport how events reach the clients
 * @property {(server: HttpServer) => void} attach answer WebSocket upgrades on this server, a no-op for Server-Sent Events
 * @property {(req: IncomingMessage, res: ServerResponse) => void} handle answer a request on the endpoint's path
 * @property {(payload: Payload | { action: string }) => void} publish publish a payload to every client
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
    pathMatch,
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
    StatsOptions,
    MiddlewareStatsOption,
    HotOptions,
    Payload,
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
/**
 * @param {number} heartbeat heartbeat interval in milliseconds
 * @param {Logger} logger logger
 * @returns {EventStream} event stream
 */
declare function createEventStream(
  heartbeat: number,
  logger: Logger,
): EventStream;
/**
 * @param {(string | StatsError)[]} errors errors or warnings
 * @returns {string[]} flat strings
 */
declare function formatErrors(errors: (string | StatsError)[]): string[];
/**
 * @param {string | undefined} url url
 * @param {string} expected expected pathname
 * @returns {boolean} true when the url pathname matches the expected path
 */
declare function pathMatch(url: string | undefined, expected: string): boolean;
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
   * answer WebSocket upgrades on this server, a no-op for Server-Sent Events
   */
  attach: (server: HttpServer) => void;
  /**
   * answer a request on the endpoint's path
   */
  handle: (req: IncomingMessage, res: ServerResponse) => void;
  /**
   * publish a payload to every client
   */
  publish: (
    payload:
      | Payload
      | {
          action: string;
        },
  ) => void;
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
type StatsOptions = import("webpack").StatsOptions;
type MiddlewareStatsOption = import("webpack").Configuration["stats"];
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
};
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
   * answer a request on the endpoint's path
   */
  handler: (req: IncomingMessage, res: ServerResponse) => void;
  /**
   * true when at least one client is connected
   */
  hasClients: () => boolean;
  /**
   * called with each client once it has joined
   */
  onConnect: (fn: (client: TClient) => void) => void;
  /**
   * publish a payload to every client
   */
  publish: (
    payload:
      | Payload
      | {
          action: string;
        },
  ) => void;
  /**
   * publish a payload to a single client
   */
  publishTo: (
    client: TClient,
    payload:
      | Payload
      | {
          action: string;
        },
  ) => void;
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
};
/**
 * Builds a transport of your own. The same calls `createHot` makes of the
 * built-in two are made of whatever this returns.
 */
type ClientStreamFactory<TClient extends unknown = StreamClient> = (
  options: {
    path: string;
    heartbeat: number;
  },
  logger: Logger,
) => ClientStream<TClient>;
type EventStream = ClientStream;
