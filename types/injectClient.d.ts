export = injectHotClient;
/**
 * Put the hot runtime into the compilation, so enabling `hot` is the whole of
 * what a developer has to do: no entry to add, no `HotModuleReplacementPlugin`
 * to remember, no configuration to change.
 *
 * The client is given the endpoint and the transport through its resource
 * query, so it agrees with the server by construction rather than by the
 * developer keeping two settings in step.
 * @param {Compiler[]} compilers compilers to modify
 * @param {{ path: string, transport: NonNullable<HotOptions["transport"]>, inject?: boolean }} options resolved hot options
 * @param {Logger} logger logger
 */
declare function injectHotClient(
  compilers: Compiler[],
  options: {
    path: string;
    transport: NonNullable<HotOptions["transport"]>;
    inject?: boolean;
  },
  logger: Logger,
): void;
declare namespace injectHotClient {
  export {
    hasClientEntry,
    isWebTarget,
    Compiler,
    Logger,
    HotOptions,
    EXPECTED_ANY,
  };
}
/**
 * Whether every entry point already pulls the client in.
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when nothing needs adding
 */
declare function hasClientEntry(compiler: Compiler): boolean;
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
declare function isWebTarget(compiler: Compiler): boolean;
type Compiler = import("webpack").Compiler;
type Logger = import("./index.js").Logger;
type HotOptions = import("./hot.js").HotOptions;
type EXPECTED_ANY = any;
