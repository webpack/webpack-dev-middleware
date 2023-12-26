const memfs = require("memfs");

/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").Context<Request, Response>} context
 */
function setupOutputFileSystem(context) {
  let outputFileSystem;

  if (context.options.outputFileSystem) {
    const { outputFileSystem: outputFileSystemFromOptions } = context.options;

    outputFileSystem = outputFileSystemFromOptions;
  }
  // Don't use `memfs` when developer wants to write everything to a disk, because it doesn't make sense.
  else if (context.options.writeToDisk !== true) {
    outputFileSystem = memfs.createFsFromVolume(new memfs.Volume());
  } else {
    const isMultiCompiler =
      /** @type {MultiCompiler} */
      (context.compiler).compilers;

    if (isMultiCompiler) {
      // Prefer compiler with `devServer` option or fallback on the first
      // TODO we need to support webpack-dev-server as a plugin or revisit it
      const compiler =
        /** @type {MultiCompiler} */
        (context.compiler).compilers.filter((item) =>
          Object.prototype.hasOwnProperty.call(item.options, "devServer"),
        );

      ({ outputFileSystem } =
        compiler[0] ||
        /** @type {MultiCompiler} */
        (context.compiler).compilers[0]);
    } else {
      ({ outputFileSystem } = context.compiler);
    }
  }

  const compilers =
    /** @type {MultiCompiler} */
    (context.compiler).compilers || [context.compiler];

  for (const compiler of compilers) {
    compiler.outputFileSystem = outputFileSystem;
  }

  // @ts-ignore
  // eslint-disable-next-line no-param-reassign
  context.outputFileSystem = outputFileSystem;
}

module.exports = setupOutputFileSystem;
