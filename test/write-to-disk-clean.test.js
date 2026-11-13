import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import CopyPlugin from "copy-webpack-plugin";
import { Volume, createFsFromVolume } from "memfs";
import request from "supertest";
import webpack from "webpack";

import middleware from "../src";

jest.spyOn(globalThis.console, "log").mockImplementation();

// Links and permissions need privileges or mean nothing on Windows.
const describeWithLinksAndPermissions =
  os.platform() === "win32" ? describe.skip : describe;

// `output.clean` with `writeToDisk`: the files on disk are cleaned as webpack
// cleans its output, in standalone mode and in plugin mode alike — with
// `writeToDisk: true` webpack does it itself, as the real file system is its
// output file system; with a function, webpack writes through a file system
// writing to memory and to disk, and cleans both.
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
   * @param {import("webpack").Configuration["plugins"]=} plugins plugins
   * @returns {import("webpack").Compiler} compiler
   */
  function createCompiler(output, plugins = []) {
    return webpack({
      mode: "development",
      devtool: false,
      context: directory,
      entry: "./index.js",
      output: { path: dist, filename: "main.[contenthash].js", ...output },
      plugins,
      infrastructureLogging: { level: "error" },
      stats: "none",
    });
  }

  /**
   * @returns {string[]} the files in `dist`, relative to it
   */
  function listDist() {
    // Paths as strings rather than `Dirent`s: `Dirent#parentPath` is newer
    // than the oldest Node.js this package supports.
    return fs
      .readdirSync(dist, { recursive: true, encoding: "utf8" })
      .filter((file) => fs.statSync(path.join(dist, file)).isFile())
      .map((file) => file.replaceAll("\\", "/"))
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
   * @param {() => void=} change the change, the entry's source by default
   * @returns {Promise<void>} once rebuilt
   */
  async function rebuild(
    compiler,
    change = () =>
      fs.writeFileSync(path.join(directory, "index.js"), "console.log(2);"),
  ) {
    let changed = false;
    let rebuilding = false;
    // The build run after the change: the watcher may run one more for the files
    // the test wrote before it started, as on macOS. `watchRun` is called again
    // when a build is restarted, which keeps its `startTime`, so that is not used.
    compiler.hooks.watchRun.tap("test", () => {
      rebuilding = changed;
    });
    const done = new Promise((resolve) => {
      compiler.hooks.done.tap("test", () => {
        if (rebuilding) {
          resolve();
        }
      });
    });

    // Past the watcher's start, so the change is seen as one.
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
    change();
    changed = true;

    await done;
    // The middleware writes to disk as the build emits; let it finish.
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  /**
   * @param {string} file a file in `dist`
   * @returns {string} its path
   */
  function inDist(file) {
    return path.join(dist, file);
  }

  /**
   * @param {string} file a file in `dist`
   * @returns {string} its content
   */
  function readDist(file) {
    return fs.readFileSync(inDist(file), "utf8");
  }

  /**
   * @param {string} file a source file
   * @param {string} content its content
   */
  function writeSource(file, content) {
    fs.writeFileSync(path.join(directory, file), content);
  }

  /**
   * @param {string} file a file in `public`
   * @returns {string} its path
   */
  function inPublic(file) {
    return path.join(directory, "public", file);
  }

  /**
   * @param {string} file a file in `public`
   * @param {string=} content its new content, or none to remove it
   */
  function changePublic(file, content) {
    const target = inPublic(file);

    if (typeof content === "string") {
      fs.writeFileSync(target, content);
    } else {
      fs.rmSync(target);
    }
  }

  /**
   * Create `public`, for copy-webpack-plugin or `output.copy` to copy to the output.
   */
  function createPublic() {
    fs.mkdirSync(path.join(directory, "public", "images"), { recursive: true });
    changePublic("robots.txt", "v1");
    changePublic("images/logo.svg", "<svg/>");
  }

  const copiers = [
    [
      "copy-webpack-plugin",
      (patterns) =>
        createCompiler({ clean: true }, [new CopyPlugin({ patterns })]),
    ],
    [
      "output.copy",
      (patterns) => createCompiler({ clean: true, copy: patterns }),
    ],
  ];

  const writeToDiskValues = [
    ["true", true],
    ["a function", () => true],
  ];

  for (const [mode, isPlugin] of [
    ["standalone", false],
    ["plugin", true],
  ]) {
    describe(`in ${mode} mode`, () => {
      it('cleans the disk on the first build and on a rebuild with "writeToDisk" true, as webpack writes there itself', async () => {
        const compiler = createCompiler({ clean: true });
        const { instance, close } = start(
          compiler,
          { writeToDisk: true },
          isPlugin,
        );

        try {
          await built(instance);

          const first = listDist();

          expect(first).toEqual([
            expect.stringMatching(/^main\.[0-9a-f]+\.js$/),
          ]);

          await rebuild(compiler);

          const second = listDist();

          expect(second).toEqual([
            expect.stringMatching(/^main\.[0-9a-f]+\.js$/),
          ]);
          expect(second[0]).not.toBe(first[0]);
        } finally {
          await close();
        }
      });

      describe("when writing to disk besides the served file system", () => {
        it('cleans the disk on the first build and on a rebuild with "writeToDisk" a function', async () => {
          const writeToDisk = () => true;
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

        it('writes to disk, and cleans it, with "writeToDisk" true and an "outputFileSystem" of your own', async () => {
          const compiler = createCompiler({ clean: true });
          const { instance, close } = start(
            compiler,
            {
              writeToDisk: true,
              outputFileSystem: createFsFromVolume(new Volume()),
            },
            isPlugin,
          );

          try {
            await built(instance);

            // Before, nothing reached the disk at all: only the stale files.
            expect(listDist()).toEqual([
              expect.stringMatching(/^main\.[0-9a-f]+\.js$/),
            ]);
          } finally {
            await close();
          }
        });

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

        it("writes to disk a chunk named with a query string under its file name", async () => {
          writeSource(
            "index.js",
            'import(/* webpackChunkName: "lazy" */ "./lazy.js");',
          );
          writeSource("lazy.js", "console.log(1);");

          const compiler = createCompiler({
            clean: true,
            chunkFilename: "[name].js?[contenthash]",
          });
          const { instance, close } = start(
            compiler,
            { writeToDisk: (targetPath) => targetPath.endsWith(".js") },
            isPlugin,
          );

          try {
            await built(instance);

            // Cleaning it once it is gone is up to webpack's `output.clean`,
            // which has to match such a name to its file.
            expect(listDist()).toEqual([
              "lazy.js",
              expect.stringMatching(/^main\.[0-9a-f]+\.js$/),
            ]);
          } finally {
            await close();
          }
        });

        for (const [copier, createCopyingCompiler] of copiers) {
          describe(`with ${copier}`, () => {
            beforeEach(createPublic);

            for (const [label, writeToDisk] of writeToDiskValues) {
              it(`writes the copied files to disk and keeps them clean with "writeToDisk" ${label}`, async () => {
                const compiler = createCopyingCompiler([{ from: "public" }]);
                const { instance, close } = start(
                  compiler,
                  { writeToDisk },
                  isPlugin,
                );
                const bundle = expect.stringMatching(/^main\.[0-9a-f]+\.js$/);

                try {
                  await built(instance);

                  // The copied files beside the bundle, the stale ones gone.
                  expect(listDist()).toEqual([
                    "images/logo.svg",
                    bundle,
                    "robots.txt",
                  ]);

                  // A rebuild of the bundle leaves what is still copied.
                  const [, firstBundle] = listDist();

                  await rebuild(compiler);

                  expect(listDist()).toEqual([
                    "images/logo.svg",
                    bundle,
                    "robots.txt",
                  ]);
                  expect(listDist()[1]).not.toBe(firstBundle);

                  // A changed file is copied again.
                  await rebuild(compiler, () =>
                    changePublic("robots.txt", "v2"),
                  );

                  expect(readDist("robots.txt")).toBe("v2");

                  // One no longer copied is cleaned.
                  await rebuild(compiler, () =>
                    changePublic("images/logo.svg"),
                  );

                  expect(listDist()).toEqual([bundle, "robots.txt"]);
                } finally {
                  await close();
                }
              });
            }

            it("leaves the copied files off disk when the function does not write them", async () => {
              // One of them on disk from an earlier session, to be cleaned.
              fs.writeFileSync(inDist("robots.txt"), "old");

              const compiler = createCopyingCompiler([{ from: "public" }]);
              const { instance, close } = start(
                compiler,
                { writeToDisk: (targetPath) => targetPath.endsWith(".js") },
                isPlugin,
              );

              try {
                await built(instance);

                // Served from memory, never written, and the stale files cleaned, the
                // earlier copy of one the function skips too.
                expect(listDist()).toEqual([
                  expect.stringMatching(/^main\.[0-9a-f]+\.js$/),
                ]);
                expect(
                  instance.context.outputFileSystem
                    .readFileSync(inDist("robots.txt"))
                    .toString(),
                ).toBe("v1");
              } finally {
                await close();
              }
            });
          });
        }

        describeWithLinksAndPermissions(
          "with output.copy, links and permissions",
          () => {
            beforeEach(createPublic);

            it("writes a copied link to disk as a link, and the permissions it keeps", async () => {
              fs.chmodSync(inPublic("robots.txt"), 0o755);
              fs.symlinkSync("robots.txt", inPublic("link.txt"));

              const compiler = createCompiler({
                clean: true,
                copy: [
                  {
                    from: "public",
                    globOptions: { followSymlinks: false },
                    preservePermissions: true,
                  },
                ],
              });
              const { instance, close } = start(
                compiler,
                { writeToDisk: () => true },
                isPlugin,
              );

              try {
                await built(instance);

                expect(fs.lstatSync(inDist("link.txt")).isSymbolicLink()).toBe(
                  true,
                );
                expect(fs.readlinkSync(inDist("link.txt"))).toBe("robots.txt");
                expect(fs.statSync(inDist("robots.txt")).mode & 0o777).toBe(
                  0o755,
                );
              } finally {
                await close();
              }
            });
          },
        );
      });
    });
  }

  /**
   * @returns {import("memfs").IFs} a file system in memory
   */
  function createMemoryFileSystem() {
    return createFsFromVolume(new Volume());
  }

  /**
   * @param {import("memfs").IFs} memory a file system in memory
   * @returns {string[]} the files in `dist` on it, relative to it
   */
  function listMemory(memory) {
    if (!memory.existsSync(dist)) {
      return [];
    }

    /** @type {string[]} */
    const files = [];
    /**
     * @param {string} directory a directory in `dist`, relative to it
     */
    const walk = (directory) => {
      // One level at a time: memfs lists recursively with the full path on Windows.
      for (const name of /** @type {string[]} */ (
        memory.readdirSync(path.join(dist, directory), { encoding: "utf8" })
      )) {
        const file = directory ? `${directory}/${name}` : name;

        if (memory.statSync(path.join(dist, file)).isDirectory()) {
          walk(file);
        } else {
          files.push(file);
        }
      }
    };

    walk("");

    return files.toSorted();
  }

  /**
   * A file system of your own, with only the methods named, as webpack can be
   * given one lacking those it does without.
   * @param {import("memfs").IFs} memory the file system in memory behind it
   * @param {string[]} names the methods it has
   * @returns {import("../src").OutputFileSystem} the file system
   */
  function withMethods(memory, names) {
    /** @type {Record<string, EXPECTED_ANY>} */
    const fileSystem = { join: path.join, dirname: path.dirname };

    for (const name of names) {
      fileSystem[name] = memory[name].bind(memory);
    }

    return /** @type {import("../src").OutputFileSystem} */ (fileSystem);
  }

  /**
   * @param {import("../src").API} instance middleware
   * @returns {import("supertest").Agent} requests to it
   */
  function requestTo(instance) {
    return request((req, res) => {
      instance(req, res, () => {
        res.statusCode = 404;
        res.end();
      });
    });
  }

  /**
   * @param {import("webpack").Compiler} compiler compiler
   * @returns {Promise<Error>} the error a build fails with, as a failed emit does
   */
  function failure(compiler) {
    return new Promise((resolve) => {
      compiler.hooks.failed.tap("test", resolve);
    });
  }

  const bundle = expect.stringMatching(/^main\.[0-9a-f]+\.js$/);

  /**
   * @param {string[]} names the names of the compilers, each writing to its own directory in `dist`
   * @param {import("webpack").Configuration["output"]=} output output options
   * @returns {import("webpack").MultiCompiler} a multi-compiler
   */
  function createMultiCompiler(names, output = {}) {
    return webpack(
      names.map((name) => ({
        name,
        mode: "development",
        devtool: false,
        context: directory,
        entry: "./index.js",
        output: {
          path: path.join(dist, name),
          filename: "main.[contenthash].js",
          clean: true,
          ...output,
        },
        infrastructureLogging: { level: "error" },
        stats: "none",
      })),
    );
  }

  for (const [mode, isPlugin] of [
    ["standalone", false],
    ["plugin", true],
  ]) {
    describe(`with a file system of your own, in ${mode} mode`, () => {
      describe("on the compiler", () => {
        it('writes to disk and to it, and cleans both, with "writeToDisk" true', async () => {
          const memory = createMemoryFileSystem();

          memory.mkdirSync(inDist("."), { recursive: true });
          memory.writeFileSync(inDist("stale-in-memory.js"), "old");

          const compiler = createCompiler({ clean: true });

          compiler.outputFileSystem = memory;

          const { instance, close } = start(
            compiler,
            { writeToDisk: true },
            isPlugin,
          );

          try {
            await built(instance);

            // Served from it, and the disk written too: before, nothing was.
            expect(instance.context.outputFileSystem).toBe(memory);
            expect(listDist()).toEqual([bundle]);
            expect(listMemory(memory)).toEqual(listDist());

            const [first] = listDist();

            await rebuild(compiler);

            expect(listDist()).toEqual([bundle]);
            expect(listDist()[0]).not.toBe(first);
            expect(listMemory(memory)).toEqual(listDist());
          } finally {
            await close();
          }
        });

        it("does not write what was in it alone to disk", async () => {
          const memory = createMemoryFileSystem();

          memory.mkdirSync(inDist("only"), { recursive: true });
          memory.writeFileSync(inDist("only/in-memory.js"), "old");

          const compiler = createCompiler({ clean: { keep: /in-memory/ } });

          compiler.outputFileSystem = memory;

          const { instance, close } = start(
            compiler,
            { writeToDisk: true },
            isPlugin,
          );

          try {
            await built(instance);

            expect(listMemory(memory)).toEqual([bundle, "only/in-memory.js"]);
            // Kept where it was, not copied to disk; what was on disk is cleaned.
            expect(listDist()).toEqual([bundle]);
          } finally {
            await close();
          }
        });

        it("writes the disk once when it is Node.js `fs`, as Rspack's", async () => {
          const compiler = createCompiler({ clean: true });

          compiler.outputFileSystem = fs;

          const { instance, close } = start(
            compiler,
            { writeToDisk: true },
            isPlugin,
          );

          try {
            await built(instance);

            expect(compiler.outputFileSystem).toBe(fs);
            expect(listDist()).toEqual([bundle]);

            const [first] = listDist();

            await rebuild(compiler);

            expect(listDist()).toEqual([bundle]);
            expect(listDist()[0]).not.toBe(first);
          } finally {
            await close();
          }
        });

        it('keeps the file system of webpack, which is the disk, with "writeToDisk" true', async () => {
          const compiler = createCompiler({ clean: true });
          const { outputFileSystem } = compiler;
          const { instance, close } = start(
            compiler,
            { writeToDisk: true },
            isPlugin,
          );

          try {
            await built(instance);

            expect(compiler.outputFileSystem).toBe(outputFileSystem);
            expect(instance.context.outputFileSystem).toBe(outputFileSystem);
            expect(listDist()).toEqual([bundle]);
          } finally {
            await close();
          }
        });
      });

      describe('in "outputFileSystem"', () => {
        for (const [label, writeToDisk] of writeToDiskValues) {
          it(`writes to disk and to it, and cleans both, with "writeToDisk" ${label}`, async () => {
            const memory = createMemoryFileSystem();
            const compiler = createCompiler({ clean: true });
            const { instance, close } = start(
              compiler,
              { writeToDisk, outputFileSystem: memory },
              isPlugin,
            );

            try {
              await built(instance);

              expect(instance.context.outputFileSystem).toBe(memory);
              expect(listDist()).toEqual([bundle]);
              expect(listMemory(memory)).toEqual([bundle]);

              const [first] = listDist();

              // What is on disk is what is served.
              expect(readDist(first)).toBe(
                memory.readFileSync(inDist(first), "utf8"),
              );

              await rebuild(compiler);

              expect(listDist()).toEqual([bundle]);
              expect(listDist()[0]).not.toBe(first);
              expect(listMemory(memory)).toEqual(listDist());
            } finally {
              await close();
            }
          });
        }

        it("cleans what was left in it and what was left on disk, without writing the one to the other", async () => {
          const memory = createMemoryFileSystem();

          memory.mkdirSync(inDist("old"), { recursive: true });
          memory.writeFileSync(inDist("old/stale-in-memory.js"), "old");

          const compiler = createCompiler({ clean: true });
          const { instance, close } = start(
            compiler,
            { writeToDisk: () => true, outputFileSystem: memory },
            isPlugin,
          );

          try {
            await built(instance);

            expect(listMemory(memory)).toEqual([bundle]);
            expect(listDist()).toEqual([bundle]);
            // The directories emptied are removed too.
            expect(fs.existsSync(inDist("nested"))).toBe(false);
            expect(memory.existsSync(inDist("old"))).toBe(false);
          } finally {
            await close();
          }
        });

        it("writes to disk only what the function takes, and serves the rest from it", async () => {
          createPublic();

          const memory = createMemoryFileSystem();
          const compiler = createCompiler({
            clean: true,
            copy: [{ from: "public" }],
          });
          const { instance, close } = start(
            compiler,
            {
              writeToDisk: (targetPath) => !targetPath.endsWith(".svg"),
              outputFileSystem: memory,
            },
            isPlugin,
          );

          try {
            await built(instance);

            expect(listDist()).toEqual([bundle, "robots.txt"]);
            expect(listMemory(memory)).toEqual([
              "images/logo.svg",
              bundle,
              "robots.txt",
            ]);

            const response = await requestTo(instance).get("/images/logo.svg");

            expect(response.statusCode).toBe(200);
            expect(response.body.toString()).toBe("<svg/>");

            await rebuild(compiler, () => changePublic("images/logo.svg"));

            expect(listMemory(memory)).toEqual([bundle, "robots.txt"]);
            expect(listDist()).toEqual([bundle, "robots.txt"]);
            expect(
              (await requestTo(instance).get("/images/logo.svg")).statusCode,
            ).toBe(404);
          } finally {
            await close();
          }
        });

        it("keeps on disk and in it what `clean.keep` keeps", async () => {
          const memory = createMemoryFileSystem();

          memory.mkdirSync(inDist("."), { recursive: true });
          memory.writeFileSync(inDist("kept.css"), "old");
          memory.writeFileSync(inDist("removed.js"), "old");

          const compiler = createCompiler({ clean: { keep: /\.css$/ } });
          const { instance, close } = start(
            compiler,
            { writeToDisk: true, outputFileSystem: memory },
            isPlugin,
          );

          try {
            await built(instance);

            expect(listDist()).toEqual([bundle, "nested/stale.css"]);
            expect(listMemory(memory)).toEqual(["kept.css", bundle]);
          } finally {
            await close();
          }
        });

        it("removes nothing from disk or from it with `clean.dry`", async () => {
          const memory = createMemoryFileSystem();

          memory.mkdirSync(inDist("."), { recursive: true });
          memory.writeFileSync(inDist("stale-in-memory.js"), "old");

          const compiler = createCompiler({ clean: { dry: true } });
          const { instance, close } = start(
            compiler,
            { writeToDisk: () => true, outputFileSystem: memory },
            isPlugin,
          );

          try {
            await built(instance);

            expect(listDist()).toEqual([
              bundle,
              "nested/stale.css",
              "stale.js",
            ]);
            expect(listMemory(memory)).toEqual([bundle, "stale-in-memory.js"]);
          } finally {
            await close();
          }
        });

        it("serves and writes to disk the same content after a rebuild", async () => {
          const memory = createMemoryFileSystem();
          const compiler = createCompiler({ clean: true });
          const { instance, close } = start(
            compiler,
            { writeToDisk: () => true, outputFileSystem: memory },
            isPlugin,
          );

          try {
            await built(instance);
            await rebuild(compiler);

            const [file] = listDist();
            const response = await requestTo(instance).get(`/${file}`);

            expect(response.statusCode).toBe(200);
            expect(response.text).toContain("console.log(2)");
            expect(readDist(file)).toBe(response.text);
          } finally {
            await close();
          }
        });

        for (const [label, getFileSystem] of [
          ["Node.js `fs`", () => fs],
          [
            "the file system of webpack",
            (compiler) => compiler.outputFileSystem,
          ],
        ]) {
          it(`writes the disk once when it is ${label}`, async () => {
            const compiler = createCompiler({ clean: true });
            const outputFileSystem = getFileSystem(compiler);
            const { instance, close } = start(
              compiler,
              { writeToDisk: () => true, outputFileSystem },
              isPlugin,
            );

            try {
              await built(instance);

              // Given as it is, so nothing is written or removed twice.
              expect(compiler.outputFileSystem).toBe(outputFileSystem);
              expect(listDist()).toEqual([bundle]);

              const [first] = listDist();

              await rebuild(compiler);

              expect(listDist()).toEqual([bundle]);
              expect(listDist()[0]).not.toBe(first);
            } finally {
              await close();
            }
          });
        }

        it("writes to disk, and cleans it, with one lacking what webpack does without", async () => {
          const memory = createMemoryFileSystem();
          // No `lstat`, `readlink`, `symlink`, `chmod` or `utimes`.
          const outputFileSystem = withMethods(memory, [
            "mkdir",
            "writeFile",
            "stat",
            "readFile",
            "readdir",
            "unlink",
            "rmdir",
            "statSync",
            "readFileSync",
            "createReadStream",
          ]);
          const compiler = createCompiler({ clean: true });
          const { instance, close } = start(
            compiler,
            { writeToDisk: () => true, outputFileSystem },
            isPlugin,
          );

          try {
            await built(instance);

            expect(listDist()).toEqual([bundle]);
            expect(listMemory(memory)).toEqual([bundle]);

            const [first] = listDist();

            await rebuild(compiler);

            expect(listDist()).toEqual([bundle]);
            expect(listDist()[0]).not.toBe(first);
            expect(listMemory(memory)).toEqual(listDist());
          } finally {
            await close();
          }
        });

        it("cleans the disk with one that cannot list or remove files", async () => {
          const memory = createMemoryFileSystem();
          const outputFileSystem = withMethods(memory, [
            "mkdir",
            "writeFile",
            "stat",
            "readFile",
          ]);
          const compiler = createCompiler({ clean: true });
          const { instance, close } = start(
            compiler,
            { writeToDisk: () => true, outputFileSystem },
            isPlugin,
          );

          try {
            await built(instance);

            expect(listDist()).toEqual([bundle]);

            const [first] = listDist();

            await rebuild(compiler);

            expect(listDist()).toEqual([bundle]);
            expect(listDist()[0]).not.toBe(first);
          } finally {
            await close();
          }
        });

        for (const [label, clean] of [
          ["`clean.keep` a string", { keep: "robots" }],
          ["`clean.keep` a RegExp", { keep: /^robots/ }],
          [
            "`clean.keep` a function",
            { keep: (file) => file === "robots.txt" },
          ],
          ["`clean.keep` a glob", { keep: { glob: "robots.*" } }],
          ["`clean.dry`", { dry: true }],
        ]) {
          it(`keeps the copy on disk of a file the function leaves out with ${label}`, async () => {
            createPublic();
            fs.writeFileSync(inDist("robots.txt"), "old");

            const memory = createMemoryFileSystem();
            const compiler = createCompiler({
              clean,
              copy: [{ from: "public" }],
            });
            const { instance, close } = start(
              compiler,
              {
                writeToDisk: (targetPath) => targetPath.endsWith(".js"),
                outputFileSystem: memory,
              },
              isPlugin,
            );

            try {
              await built(instance);

              expect(readDist("robots.txt")).toBe("old");
              expect(memory.readFileSync(inDist("robots.txt"), "utf8")).toBe(
                "v1",
              );
            } finally {
              await close();
            }
          });
        }

        it("removes from disk the copies of what the function leaves out, for each compiler of a multi-compiler", async () => {
          for (const name of ["a", "b"]) {
            fs.mkdirSync(inDist(name), { recursive: true });
            fs.writeFileSync(inDist(`${name}/main.js`), "old");
          }

          const memory = createMemoryFileSystem();
          const compiler = createMultiCompiler(["a", "b"], {
            filename: "main.js",
          });
          const { instance, close } = start(
            compiler,
            { writeToDisk: () => false, outputFileSystem: memory },
            isPlugin,
          );

          try {
            await built(instance);

            expect(listDist()).toEqual(["nested/stale.css", "stale.js"]);
            expect(listMemory(memory)).toEqual(["a/main.js", "b/main.js"]);
          } finally {
            await close();
          }
        });

        it("keeps the times of a copied file on disk", async () => {
          createPublic();

          const time = new Date("2020-01-01T00:00:00Z");

          fs.utimesSync(inPublic("robots.txt"), time, time);

          const memory = createMemoryFileSystem();
          const compiler = createCompiler({
            clean: true,
            copy: [{ from: "public", preserveTimestamps: true }],
          });
          const { instance, close } = start(
            compiler,
            { writeToDisk: () => true, outputFileSystem: memory },
            isPlugin,
          );

          try {
            await built(instance);

            expect(fs.statSync(inDist("robots.txt")).mtime).toEqual(time);
            expect(memory.statSync(inDist("robots.txt")).mtime).toEqual(time);
          } finally {
            await close();
          }
        });

        it("fails the build, writing nothing to disk, when it cannot write a file", async () => {
          const memory = createMemoryFileSystem();
          const outputFileSystem = Object.create(memory, {
            writeFile: {
              value: (file, content, callback) =>
                callback(new Error(`Unable to write "${file}"`)),
            },
          });
          const compiler = createCompiler({ clean: true });
          const failed = failure(compiler);
          const { close } = start(
            compiler,
            { writeToDisk: () => true, outputFileSystem },
            isPlugin,
          );

          try {
            expect((await failed).message).toMatch(/Unable to write ".+main\./);
            expect(listDist()).toEqual([]);
          } finally {
            await close();
          }
        });

        it("fails the build when it cannot create a directory on disk", async () => {
          fs.writeFileSync(inDist("blocked"), "a file");

          const memory = createMemoryFileSystem();
          const compiler = createCompiler({
            clean: true,
            path: inDist("blocked/out"),
          });
          const failed = failure(compiler);
          const { close } = start(
            compiler,
            { writeToDisk: () => true, outputFileSystem: memory },
            isPlugin,
          );

          try {
            expect((await failed).code).toMatch(/^E/);
            expect(readDist("blocked")).toBe("a file");
          } finally {
            await close();
          }
        });

        it("fails the build when it cannot write a file to disk", async () => {
          // A directory where the bundle goes.
          fs.mkdirSync(inDist("main.js"));

          const memory = createMemoryFileSystem();
          const compiler = createCompiler({
            clean: { keep: "main.js" },
            filename: "main.js",
          });
          const failed = failure(compiler);
          const { close } = start(
            compiler,
            { writeToDisk: () => true, outputFileSystem: memory },
            isPlugin,
          );

          try {
            expect((await failed).code).toMatch(/^E/);
            expect(fs.statSync(inDist("main.js")).isDirectory()).toBe(true);
          } finally {
            await close();
          }
        });

        it("cleans the disk of each compiler of a multi-compiler", async () => {
          const memory = createMemoryFileSystem();

          for (const name of ["a", "b"]) {
            fs.mkdirSync(inDist(name), { recursive: true });
            fs.writeFileSync(inDist(`${name}/stale.js`), "old");
          }

          const compiler = createMultiCompiler(["a", "b"]);
          const { instance, close } = start(
            compiler,
            { writeToDisk: () => true, outputFileSystem: memory },
            isPlugin,
          );

          try {
            await built(instance);

            const inA = expect.stringMatching(/^a\/main\.[0-9a-f]+\.js$/);
            const inB = expect.stringMatching(/^b\/main\.[0-9a-f]+\.js$/);

            // The earlier session's files in `dist` itself are no compiler's.
            expect(listDist()).toEqual([
              inA,
              inB,
              "nested/stale.css",
              "stale.js",
            ]);
            expect(listMemory(memory)).toEqual([inA, inB]);
          } finally {
            await close();
          }
        });
      });
    });
  }
});
