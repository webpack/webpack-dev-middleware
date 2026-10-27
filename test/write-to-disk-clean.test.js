import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import CopyPlugin from "copy-webpack-plugin";
import { Volume, createFsFromVolume } from "memfs";
import webpack from "webpack";

import middleware from "../src";

jest.spyOn(globalThis.console, "log").mockImplementation();

// Where webpack writes to more outputs than its own, `writeToDisk` adds the
// real disk as one, and `output.clean` cleans it as webpack's own output.
const hasAdditionalOutputs = "additionalOutputs" in webpack({}).hooks;
const describeWithAdditionalOutputs = hasAdditionalOutputs
  ? describe
  : describe.skip;
const describeWithoutAdditionalOutputs = hasAdditionalOutputs
  ? describe.skip
  : describe;
// Links and permissions need privileges or mean nothing on Windows.
const describeWithLinksAndPermissions =
  os.platform() === "win32" ? describe.skip : describe;

// `output.clean` with `writeToDisk`: the files on disk are cleaned as webpack
// cleans its output, in standalone mode and in plugin mode alike — with
// `writeToDisk: true` webpack does it itself, as the real file system is its
// output file system; with a function, webpack writes to memory and to the
// disk, an additional output it cleans too.
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
    /** @type {number} */
    let changedAt = Infinity;
    // The build that started after the change: the watcher may run one more
    // for the files the test wrote before it started, as on macOS.
    const done = new Promise((resolve) => {
      compiler.hooks.done.tap("test", (stats) => {
        if (stats.startTime >= changedAt) {
          resolve();
        }
      });
    });

    // Past the watcher's start, so the change is seen as one.
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
    change();
    changedAt = Date.now();

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

      describeWithoutAdditionalOutputs(
        "when webpack has no `additionalOutputs`, as before 5.113.0 and with Rspack",
        () => {
          it('copies to disk itself, without cleaning it, with "writeToDisk" a function', async () => {
            const compiler = createCompiler({ clean: true });
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
        },
      );

      describeWithAdditionalOutputs(
        "when webpack writes to disk as an additional output",
        () => {
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

          it("cleans from disk a chunk named with a query string once it is gone", async () => {
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

              expect(listDist()).toEqual([
                "lazy.js",
                expect.stringMatching(/^main\.[0-9a-f]+\.js$/),
              ]);

              // The entry no longer imports it, so the chunk is gone.
              await rebuild(compiler);

              expect(listDist()).toEqual([
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

                  expect(
                    fs.lstatSync(inDist("link.txt")).isSymbolicLink(),
                  ).toBe(true);
                  expect(fs.readlinkSync(inDist("link.txt"))).toBe(
                    "robots.txt",
                  );
                  expect(fs.statSync(inDist("robots.txt")).mode & 0o777).toBe(
                    0o755,
                  );
                } finally {
                  await close();
                }
              });
            },
          );
        },
      );
    });
  }
});
