import path from 'path';

import MemoryFileSystem from 'memory-fs';

import DevMiddlewareError from '../DevMiddlewareError';

export default function setupOutputFileSystem(compiler, context) {
  if (
    typeof compiler.outputPath === 'string' &&
    !path.posix.isAbsolute(compiler.outputPath) &&
    !path.win32.isAbsolute(compiler.outputPath)
  ) {
    throw new DevMiddlewareError(
      '`output.path` needs to be an absolute path or `/`.'
    );
  }

  let fileSystem;

  // store our files in memory
  const isConfiguredOutputFileSystem = context.options.outputFileSystem;
  const isMemoryFs =
    !isConfiguredOutputFileSystem &&
    !compiler.compilers &&
    compiler.outputFileSystem instanceof MemoryFileSystem;

  if (isConfiguredOutputFileSystem) {
    // eslint-disable-next-line no-shadow
    const { outputFileSystem } = context.options;

    if (typeof outputFileSystem.join !== 'function') {
      // very shallow check
      throw new Error(
        'Invalid options: options.outputFileSystem.join() method is expected'
      );
    }

    // eslint-disable-next-line no-param-reassign
    compiler.outputFileSystem = outputFileSystem;
    fileSystem = outputFileSystem;
  } else if (isMemoryFs) {
    fileSystem = compiler.outputFileSystem;
  } else {
    fileSystem = new MemoryFileSystem();

    // eslint-disable-next-line no-param-reassign
    compiler.outputFileSystem = fileSystem;
  }

  // eslint-disable-next-line no-param-reassign
  context.outputFileSystem = fileSystem;
}

module.exports = setupOutputFileSystem;
