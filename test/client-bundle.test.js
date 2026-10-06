import path from "node:path";

import { Volume, createFsFromVolume } from "memfs";
import webpack from "webpack";

const CLIENT = path.resolve(__dirname, "../client-src/index.js");

// `"universal"` and the combined `["web", "node"]` target are webpack 5.108+.
const [major, minor] = webpack.version.split(".").map(Number);
const hasUniversalTarget = major > 5 || (major === 5 && minor >= 108);

/**
 * @param {string | string[]} target webpack target
 * @returns {Promise<{ errors: string[], source: string }>} what building the client for it produced
 */
function build(target) {
  const compiler = webpack({
    mode: "development",
    devtool: false,
    target,
    entry: CLIENT,
    output: { path: "/", filename: "client.js" },
  });
  const volume = new Volume();

  // @ts-expect-error -- memfs is enough of a filesystem for webpack to write to
  compiler.outputFileSystem = createFsFromVolume(volume);

  return new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      if (error) {
        reject(error);

        return;
      }

      const files = volume.toJSON();

      compiler.close(() => {
        resolve({
          errors: /** @type {NonNullable<typeof stats>} */ (stats)
            .toJson({ all: false, errors: true })
            .errors.map((item) => item.message),
          source: Object.values(files).join("\n"),
        });
      });
    });
  });
}

// What the client brings with it is what every page running it downloads and
// runs, wherever it was built to run. A dependency that reaches for a node
// builtin turns into a `require` of it in a build whose target allows node, and
// a page has no `require` to call.
describe("the client in a bundle for every kind of target", () => {
  const targets = [
    ["web", "web"],
    ...(hasUniversalTarget
      ? [
          ["universal", "universal"],
          ['["web", "node"]', ["web", "node"]],
        ]
      : []),
  ];

  for (const [title, target] of targets) {
    it(`needs nothing from node when built for ${title}`, async () => {
      const { errors, source } = await build(target);

      expect(errors).toEqual([]);
      // What webpack emits for a node builtin it leaves to the environment: the
      // loader it builds for them, and the module standing in for each one.
      expect(source).not.toMatch(/__WEBPACK_EXTERNAL_/);
      expect(source).not.toMatch(/external "/);
    });
  }
});
