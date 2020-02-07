export default function setupHooks(context) {
  function invalid() {
    if (context.state) {
      context.logger.info('Compiling...');
    }

    // We are now in invalid state
    // eslint-disable-next-line no-param-reassign
    context.state = false;
    // eslint-disable-next-line no-param-reassign, no-undefined
    context.stats = undefined;
  }

  function done(stats) {
    // We are now on valid state
    // eslint-disable-next-line no-param-reassign
    context.state = true;
    // eslint-disable-next-line no-param-reassign
    context.stats = stats;

    // Do the stuff in nextTick, because bundle may be invalidated if a change happened while compiling
    process.nextTick(() => {
      const { state, compiler, callbacks, logger } = context;

      // Check if still in valid state
      if (!state) {
        return;
      }

      // Print webpack output
      const printStats = (childCompiler, childStats) => {
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

      if (compiler.compilers) {
        compiler.compilers.forEach((compilerFromMultiCompileMode, index) => {
          printStats(compilerFromMultiCompileMode, stats.stats[index]);
        });
      } else {
        printStats(compiler, stats);
      }

      // eslint-disable-next-line no-param-reassign
      context.callbacks = [];

      // Execute callback that are delayed
      callbacks.forEach((cb) => {
        cb(stats);
      });
    });
  }

  context.compiler.hooks.invalid.tap('WebpackDevMiddleware', () => invalid);
  context.compiler.hooks.run.tap('WebpackDevMiddleware', invalid);
  context.compiler.hooks.done.tap('WebpackDevMiddleware', done);
  context.compiler.hooks.watchRun.tap('WebpackDevMiddleware', invalid);
}
