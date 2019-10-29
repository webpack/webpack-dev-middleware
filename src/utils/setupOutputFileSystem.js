import path from 'path';

import memfs from 'memfs';

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

  let outputFileSystem;

  if (context.options.fs) {
    // eslint-disable-next-line no-shadow
    const { fs } = context.options;

    // Todo remove when we drop webpack@4 support
    if (typeof fs.join !== 'function') {
      // very shallow check
      throw new Error('Invalid options: options.fs.join() method is expected');
    }

    outputFileSystem = fs;
  } else {
    outputFileSystem = memfs;
    outputFileSystem.vol.reset();

    // Todo remove when we drop webpack@4 support
    outputFileSystem.join = path.join.bind(path);
  }

  // eslint-disable-next-line no-param-reassign
  compiler.outputFileSystem = outputFileSystem;
  // eslint-disable-next-line no-param-reassign
  context.outputFileSystem = outputFileSystem;
}

module.exports = setupOutputFileSystem;
