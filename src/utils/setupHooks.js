export default function setupHooks(context) {
  function invalid() {
    if (context.state) {
      context.logger.log('Compilation starting...');
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
      const { compiler, logger, state, callbacks } = context;

      // Check if still in valid state
      if (!state) {
        return;
      }

      logger.log('Compilation finished');

      const statsOptions = compiler.compilers
        ? {
            children: compiler.compilers.map((oneOfCompiler) =>
              // eslint-disable-next-line no-undefined
              oneOfCompiler.options ? oneOfCompiler.options.stats : undefined
            ),
          }
        : compiler.options
        ? compiler.options.stats
        : // eslint-disable-next-line no-undefined
          undefined;

      // TODO webpack@4 doesn't support `{ children: [{ colors: true }, { colors: true }] }` for stats
      if (
        compiler.compilers &&
        !compiler.compilers.find((oneOfCompiler) => oneOfCompiler.webpack)
      ) {
        statsOptions.colors = statsOptions.children.some(
          (child) => child.colors
        );
      }

      const printedStats = stats.toString(statsOptions);

      // Avoid extra empty line when `stats: 'none'`
      if (printedStats) {
        // eslint-disable-next-line no-console
        process.stdout.write(printedStats);
      }

      // eslint-disable-next-line no-param-reassign
      context.callbacks = [];

      // Execute callback that are delayed
      callbacks.forEach((callback) => {
        callback(stats);
      });
    });
  }

  context.compiler.hooks.watchRun.tap('webpack-dev-middleware', invalid);
  context.compiler.hooks.invalid.tap('webpack-dev-middleware', invalid);
  (context.compiler.webpack
    ? context.compiler.hooks.afterDone
    : context.compiler.hooks.done
  ).tap('webpack-dev-middleware', done);
}
