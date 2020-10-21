import type webpack from 'webpack';
import type { MultiStats, WebpackDevMiddlewareContext } from '../types';
import { isMultiCompiler } from './isMultiCompiler';

export default function setupHooks(context: WebpackDevMiddlewareContext): void {
  function invalid() {
    if (context.state) {
      context.logger.info('Compiling...');
    }

    // We are now in invalid state
    context.state = false;
    context.stats = null;
  }

  function done(stats: webpack.Stats | MultiStats) {
    // We are now on valid state
    context.state = true;
    context.stats = stats;

    // Do the stuff in nextTick, because bundle may be invalidated if a change happened while compiling
    process.nextTick(() => {
      const { state, compiler, callbacks, logger } = context;

      // Check if still in valid state
      if (!state) {
        return;
      }

      // Print webpack output
      const printStats = (
        childCompiler: webpack.Compiler,
        childStats: webpack.Stats
      ) => {
        const statsString = childStats.toString(childCompiler.options.stats);
        const name = childCompiler.options.name
          ? `Child "${childCompiler.options.name}": `
          : '';

        if (statsString.length) {
          if (childStats.hasErrors()) {
            logger.error(`${name}${statsString}`);
          } else if (childStats.hasWarnings()) {
            logger.warn(`${name}${statsString}`);
          } else {
            logger.info(`${name}${statsString}`);
          }
        }

        let message = `${name}Compiled successfully.`;

        if (childStats.hasErrors()) {
          message = `${name}Failed to compile.`;
        } else if (childStats.hasWarnings()) {
          message = `${name}Compiled with warnings.`;
        }

        logger.info(message);
      };

      if (isMultiCompiler(compiler)) {
        compiler.compilers.forEach((compilerFromMultiCompileMode, index) => {
          printStats(
            compilerFromMultiCompileMode,
            (stats as MultiStats).stats[index]
          );
        });
      } else {
        printStats(compiler, stats as webpack.Stats);
      }

      context.callbacks = [];

      // Execute callback that are delayed
      callbacks.forEach(
        (
          callback:
            | ((stats: webpack.Stats) => void)
            | ((stats: MultiStats) => void)
        ) => {
          callback(stats as webpack.Stats & MultiStats);
        }
      );
    });
  }

  context.compiler.hooks.watchRun.tap('DevMiddleware', invalid);
  context.compiler.hooks.invalid.tap('DevMiddleware', invalid);
  context.compiler.hooks.done.tap('DevMiddleware', done);
}
