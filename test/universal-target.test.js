import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import webpack from "webpack";

import middleware from "../src";

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

const run = promisify(execFile);

const APP = `console.log("Hey.");

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
`;

const CLIENT = path.resolve(__dirname, "../client/index.js");

// A module of someone else's that re-exports the client and hands it the query
// written after its own name, as webpack-dev-server's `client/index.js` does.
const STAND_IN = `/* global __resourceQuery */
var inBrowser = typeof self !== "undefined";

if (inBrowser) {
  self.__webpack_dev_middleware_client_query__ = __resourceQuery;
}

module.exports = require(${JSON.stringify(CLIENT)});
`;

/**
 * Build the app the way the middleware serves it, and write it out.
 * @param {string | string[]} target webpack target
 * @param {(dir: string) => EXPECTED_ANY} hot the `hot` option, given the app's directory
 * @param {(dir: string) => EXPECTED_ANY=} entry the entry, given the app's directory
 * @returns {Promise<{ errors: string[], bundle: string, close: () => void }>} what was built, and where
 */
async function build(target, hot, entry) {
  const dir = fs.mkdtempSync(
    path.join(fs.realpathSync.native(os.tmpdir()), "wdm-universal-"),
  );

  fs.writeFileSync(path.join(dir, "app.js"), APP);
  fs.writeFileSync(path.join(dir, "stand-in.js"), STAND_IN);

  const compiler = webpack({
    mode: "development",
    devtool: false,
    context: dir,
    entry: entry ? entry(dir) : "./app.js",
    target,
    output: { path: path.join(dir, "dist") },
    infrastructureLogging: { level: "none" },
    stats: "none",
  });
  const instance = middleware(compiler, { hot: hot(dir), writeToDisk: true });

  await new Promise((resolve) => {
    instance.waitUntilValid(resolve);
  });

  const errors = /** @type {EXPECTED_ANY} */ (instance.context.stats)
    .toJson({ all: false, errors: true })
    .errors.map((/** @type {EXPECTED_ANY} */ item) => item.message);

  await new Promise((resolve) => {
    instance.close(resolve);
  });

  return {
    errors,
    bundle: path.join(dir, "dist", "main.mjs"),
    close: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** @type {[string, (dir: string) => EXPECTED_ANY, ((dir: string) => EXPECTED_ANY) | undefined, RegExp][]} */
const CLIENTS = [
  [
    "the client over Server-Sent Events",
    () => ({}),
    undefined,
    /[\\/]client[\\/]+index\.js\?/,
  ],
  [
    "the client over a WebSocket",
    () => ({ transport: "ws" }),
    undefined,
    /[\\/]client[\\/]+index\.js\?/,
  ],
  [
    "the client through a re-export of it",
    () => ({ inject: false }),
    (dir) => [`${path.join(dir, "stand-in.js")}?path=/hmr`, "./app.js"],
    /stand-in\.js\?/,
  ],
];

// Both spellings of the target, for each way of adding the client.
const CASES = ["universal", ["web", "node"]].flatMap((target) =>
  CLIENTS.map(([title, hot, entry, client]) => [
    title,
    target,
    hot,
    entry,
    client,
  ]),
);

// A universal build is one bundle for a browser and for Node. The client is in
// it for the browser — see `e2e/universal-target.test.js` — and in Node it has
// to stay out of the way: no error, nothing said, nothing left running.
describe("a universal build, run in Node", () => {
  it.each(CASES)(
    "runs %s quietly, built for %j",
    async (_title, target, hot, entry, client) => {
      const { errors, bundle, close } = await build(target, hot, entry);

      try {
        expect(errors).toEqual([]);
        // Not vacuous: the client is in what runs.
        expect(fs.readFileSync(bundle, "utf8")).toMatch(client);

        // Rejects on an exit code other than 0, and on a process still
        // running — a connection, a timer — after the timeout.
        const { stdout, stderr } = await run(process.execPath, [bundle], {
          timeout: 20000,
        });

        expect(stderr).toBe("");
        expect(stdout).toBe("Hey.\n");
      } finally {
        close();
      }
    },
  );
});
