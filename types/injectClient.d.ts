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
 * @param {{ path: string, transport: (string | EXPECTED_ANY), inject?: boolean }} options resolved hot options
 * @param {Logger} logger logger
 */
declare function injectHotClient(
  compilers: Compiler[],
  options: {
    path: string;
    transport: string | EXPECTED_ANY;
    inject?: boolean;
  },
  logger: Logger,
): void;
declare namespace injectHotClient {
  export { hasClientEntry, isWebTarget, Compiler, Logger, EXPECTED_ANY };
}
/**
 * Whether this compilation already pulls the client in. Anyone who followed the
 * documentation before it was injected for them has it in `entry`, and a second
 * copy is at best wasted bytes.
 *
 * Best effort by design: `entry` can be a function, and a request can reach the
 * client through an alias or a loader. Missing one of those costs a duplicate
 * entry, not a broken build, and `hot.inject: false` is the way out.
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when the client is already an entry
 */
declare function hasClientEntry(compiler: Compiler): boolean;
/**
 * Whether a compiler produces something a browser will run. A `web` or
 * universal target gets the client; `target: false` is `null` everywhere, so it
 * is excluded rather than treated as universal.
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when the client belongs in this compilation
 */
declare function isWebTarget(compiler: Compiler): boolean;
type Compiler = import("webpack").Compiler;
type Logger = import("./index.js").Logger;
type EXPECTED_ANY = any;
