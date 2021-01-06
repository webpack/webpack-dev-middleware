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
      const { state, callbacks } = context;

      // Check if still in valid state
      if (!state) {
        return;
      }

      // eslint-disable-next-line no-console
      console.log(stats.toString());

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
