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
  } else {
    outputFileSystem = memfs.createFsFromVolume(new memfs.Volume());
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
