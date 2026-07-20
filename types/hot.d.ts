export = createHot;
/**
 * @typedef {object} HotInstance
 * @property {string} path path the SSE endpoint is served at
 * @property {(req: IncomingMessage, res: ServerResponse) => void} handle attach the request as a SSE client
 * @property {(payload: Payload | { action: string }) => void} publish publish a payload to every client
 * @property {() => void} close end every client and detach the heartbeat
 */
/**
 * @param {Compiler | MultiCompiler} compiler compiler
 * @param {HotOptions | true} userOptions options
 * @returns {HotInstance} hot instance
 */
declare function createHot(
  compiler: Compiler | MultiCompiler,
  userOptions: HotOptions | true,
): HotInstance;
declare namespace createHot {
  export {
    HOT_DEFAULT_HEARTBEAT,
    HOT_DEFAULT_PATH,
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
    StatsOptions,
    HotOptions,
    Payload,
    EventStream,
  };
}
declare const HOT_DEFAULT_HEARTBEAT: number;
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {ReturnType<Compiler["getInfrastructureLogger"]>} Logger */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("webpack").StatsCompilation} StatsCompilation */
/** @typedef {import("webpack").StatsError} StatsError */
/** @typedef {import("./index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("./index.js").ServerResponse} ServerResponse */
/** @typedef {NonNullable<import("webpack").Configuration["stats"]>} StatsOptions */
/**
 * @typedef {object} HotOptions
 * @property {string=} path the path the SSE endpoint is served at
 * @property {number=} heartbeat heartbeat interval in milliseconds
 * @property {StatsOptions=} statsOptions webpack stats options used when serializing compilation results
 * @property {boolean=} progress publish compilation progress events to the clients
 */
/**
 * @typedef {object} Payload
 * @property {string} action action
 * @property {string=} file file that invalidated the compilation
 * @property {string=} name name
 * @property {number=} time time
 * @property {string=} hash hash
 * @property {number=} percent compilation progress (0-100)
 * @property {string=} message progress message
 * @property {string[]=} warnings warnings
 * @property {string[]=} errors errors
 */
/**
 * @typedef {object} EventStream
 * @property {(req: IncomingMessage, res: ServerResponse) => void} handler attach a new client
 * @property {(payload: Payload | { action: string }) => void} publish publish a payload to every client
 * @property {() => void} close end every client and stop the heartbeat
 */
declare const HOT_DEFAULT_PATH: "/__webpack_hmr";
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
 * @param {StatsOptions | undefined} statsOptions stats options
 * @returns {StatsCompilation[]} normalized per-bundle stats
 */
declare function toBundles(
  statsResult: Stats | MultiStats,
  statsOptions: StatsOptions | undefined,
): StatsCompilation[];
type HotInstance = {
  /**
   * path the SSE endpoint is served at
   */
  path: string;
  /**
   * attach the request as a SSE client
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
type StatsOptions = NonNullable<import("webpack").Configuration["stats"]>;
type HotOptions = {
  /**
   * the path the SSE endpoint is served at
   */
  path?: string | undefined;
  /**
   * heartbeat interval in milliseconds
   */
  heartbeat?: number | undefined;
  /**
   * webpack stats options used when serializing compilation results
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
type EventStream = {
  /**
   * attach a new client
   */
  handler: (req: IncomingMessage, res: ServerResponse) => void;
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
   * end every client and stop the heartbeat
   */
  close: () => void;
};
