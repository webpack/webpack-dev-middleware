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
    publishStats,
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
 */
/**
 * @typedef {object} Payload
 * @property {string} action action
 * @property {string=} name name
 * @property {number=} time time
 * @property {string=} hash hash
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
 * @param {string} action action
 * @param {Stats | MultiStats} statsResult stats result
 * @param {EventStream} eventStream event stream
 * @param {StatsOptions | undefined} statsOptions stats options
 */
declare function publishStats(
  action: string,
  statsResult: Stats | MultiStats,
  eventStream: EventStream,
  statsOptions: StatsOptions | undefined,
): void;
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
};
type Payload = {
  /**
   * action
   */
  action: string;
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
