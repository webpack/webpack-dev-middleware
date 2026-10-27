import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import webpack from "webpack";

import middleware from "../src";

jest.spyOn(globalThis.console, "log").mockImplementation();

// `output.clean` with `writeToDisk`: the files on disk are cleaned as webpack
// cleans its output, in standalone mode and in plugin mode alike — with
// `writeToDisk: true` webpack does it itself, as the real file system is its
// output file system; with a function, webpack writes to memory and the
// middleware copies to disk, so it cleans the disk too.
describe("output.clean with writeToDisk", () => {
  /** @type {string} */
  let directory;
  /** @type {string} */
  let dist;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "wdm-clean-"));
    dist = path.join(directory, "dist");
    fs.writeFileSync(path.join(directory, "index.js"), "console.log(1);");
    fs.mkdirSync(path.join(dist, "nested"), { recursive: true });
    // Left from an earlier session, as webpack would find them.
    fs.writeFileSync(path.join(dist, "stale.js"), "old");
    fs.writeFileSync(path.join(dist, "nested", "stale.css"), "old");
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  /**
   * @param {import("webpack").Configuration["output"]} output output options
   * @returns {import("webpack").Compiler} compiler
   */
  function createCompiler(output) {
    return webpack({
      mode: "development",
      devtool: false,
      context: directory,
      entry: "./index.js",
      output: { path: dist, filename: "main.[contenthash].js", ...output },
      infrastructureLogging: { level: "error" },
      stats: "none",
    });
  }

  /**
   * @returns {string[]} the files in `dist`, relative to it
   */
  function listDist() {
    return fs
      .readdirSync(dist, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        path
          .relative(dist, path.join(entry.parentPath, entry.name))
          .replaceAll("\\", "/"),
      )
      .toSorted();
  }

  /**
   * Start the middleware, standalone or as a plugin with the host watching.
   * @param {import("webpack").Compiler} compiler compiler
   * @param {import("../src").Options} options options
   * @param {boolean} isPlugin plugin mode
   * @returns {{ instance: import("../src").API, close: () => Promise<void> }} the middleware and a way to stop it
   */
  function start(compiler, options, isPlugin) {
    const instance = middleware(compiler, options, isPlugin);
    const watching = isPlugin ? compiler.watch({}, () => {}) : undefined;

    return {
      instance,
      close: () =>
        new Promise((resolve) => {
          if (watching) {
            watching.close(resolve);
          } else {
            instance.close(resolve);
          }
        }),
    };
  }

  /**
   * @param {import("../src").API} instance middleware
   * @returns {Promise<void>} once the build is done
   */
  function built(instance) {
    return new Promise((resolve) => {
      instance.waitUntilValid(() => resolve());
    });
  }

  /**
   * Change the source and wait for the build the watcher starts for it.
   * @param {import("webpack").Compiler} compiler compiler
   * @returns {Promise<void>} once rebuilt
   */
  async function rebuild(compiler) {
    const done = new Promise((resolve) => {
      compiler.hooks.done.tap("test", () => resolve());
    });

    // Past the watcher's start, so the change is seen as one.
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
    fs.writeFileSync(path.join(directory, "index.js"), "console.log(2);");

    await done;
    // The middleware writes to disk as the build emits; let it finish.
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  const writeToDiskValues = [
    ["true", true],
    ["a function", () => true],
  ];

  for (const [mode, isPlugin] of [
    ["standalone", false],
    ["plugin", true],
  ]) {
    describe(`in ${mode} mode`, () => {
      for (const [label, writeToDisk] of writeToDiskValues) {
        it(`cleans the disk on the first build and on a rebuild with "writeToDisk" ${label}`, async () => {
          const compiler = createCompiler({ clean: true });
          const { instance, close } = start(
            compiler,
            { writeToDisk },
            isPlugin,
          );

          try {
            await built(instance);

            const first = listDist();

            expect(first).toHaveLength(1);
            expect(first[0]).toMatch(/^main\.[0-9a-f]+\.js$/);

            await rebuild(compiler);

            const second = listDist();

            expect(second).toHaveLength(1);
            expect(second[0]).toMatch(/^main\.[0-9a-f]+\.js$/);
            expect(second[0]).not.toBe(first[0]);
          } finally {
            await close();
          }
        });
      }

      it("keeps what `clean.keep` keeps on disk", async () => {
        const compiler = createCompiler({ clean: { keep: /\.css$/ } });
        const { instance, close } = start(
          compiler,
          { writeToDisk: () => true },
          isPlugin,
        );

        try {
          await built(instance);

          expect(listDist()).toEqual([
            expect.stringMatching(/^main\.[0-9a-f]+\.js$/),
            "nested/stale.css",
          ]);
        } finally {
          await close();
        }
      });

      it("removes nothing from disk with `clean.dry`", async () => {
        const compiler = createCompiler({ clean: { dry: true } });
        const { instance, close } = start(
          compiler,
          { writeToDisk: () => true },
          isPlugin,
        );

        try {
          await built(instance);

          expect(listDist()).toEqual([
            expect.stringMatching(/^main\.[0-9a-f]+\.js$/),
            "nested/stale.css",
            "stale.js",
          ]);
        } finally {
          await close();
        }
      });

      it("removes nothing from disk without `output.clean`", async () => {
        const compiler = createCompiler({});
        const { instance, close } = start(
          compiler,
          { writeToDisk: () => true },
          isPlugin,
        );

        try {
          await built(instance);
          await rebuild(compiler);

          // Both builds' bundles, and the earlier session's files.
          expect(listDist()).toHaveLength(4);
        } finally {
          await close();
        }
      });
    });
  }
});
