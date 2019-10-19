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
  const isConfiguredFs = context.options.fs;
  const isMemoryFs =
    !isConfiguredFs &&
    !compiler.compilers &&
    compiler.outputFileSystem instanceof MemoryFileSystem;

  if (isConfiguredFs) {
    // eslint-disable-next-line no-shadow
    const { fs } = context.options;

    if (typeof fs.join !== 'function') {
      // very shallow check
      throw new Error('Invalid options: options.fs.join() method is expected');
    }

    // eslint-disable-next-line no-param-reassign
    compiler.outputFileSystem = fs;
    fileSystem = fs;
  } else if (isMemoryFs) {
    fileSystem = compiler.outputFileSystem;
  } else {
    fileSystem = new MemoryFileSystem();

    // eslint-disable-next-line no-param-reassign
    compiler.outputFileSystem = fileSystem;
  }

  // eslint-disable-next-line no-param-reassign
  context.fs = fileSystem;
}

module.exports = setupOutputFileSystem;
