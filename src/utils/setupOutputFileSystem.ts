import path from 'path';
import { createFsFromVolume, Volume } from 'memfs';
import type {
  ExtendedOutputFileSystem,
  WebpackDevMiddlewareContext,
} from '../types';
import { isMultiCompiler } from './isMultiCompiler';

export default function setupOutputFileSystem(
  context: WebpackDevMiddlewareContext
): void {
  let outputFileSystem: ExtendedOutputFileSystem;

  if (context.options.outputFileSystem) {
    const { outputFileSystem: outputFileSystemFromOptions } = context.options;

    // Todo remove when we drop webpack@4 support
    if (typeof outputFileSystemFromOptions.join !== 'function') {
      throw new Error(
        'Invalid options: options.outputFileSystem.join() method is expected'
      );
    }

    // Todo remove when we drop webpack@4 support
    if (
      typeof (outputFileSystemFromOptions as { mkdirp?: unknown }).mkdirp !==
      'function'
    ) {
      throw new Error(
        'Invalid options: options.outputFileSystem.mkdirp() method is expected'
      );
    }

    outputFileSystem = outputFileSystemFromOptions as ExtendedOutputFileSystem;
  } else {
    outputFileSystem = createFsFromVolume(
      new Volume()
    ) as ExtendedOutputFileSystem;
    // TODO: remove when we drop webpack@4 support
    outputFileSystem.join = path.join.bind(path);
  }

  const compilers = isMultiCompiler(context.compiler)
    ? context.compiler.compilers
    : [context.compiler];

  for (const compiler of compilers) {
    compiler.outputFileSystem = outputFileSystem;
  }

  context.outputFileSystem = outputFileSystem;
}
