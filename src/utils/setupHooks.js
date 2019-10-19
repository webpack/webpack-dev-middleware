export default function setupHooks(context) {
  function invalid(callback) {
    if (context.state) {
      context.options.reporter(context.options, {
        log: context.log,
        state: false,
      });
    }

    // We are now in invalid state
    // eslint-disable-next-line no-param-reassign
    context.state = false;

    if (typeof callback === 'function') {
      callback();
    }
  }

  function done(stats) {
    // We are now on valid state
    // eslint-disable-next-line no-param-reassign
    context.state = true;
    // eslint-disable-next-line no-param-reassign
    context.webpackStats = stats;

    // Do the stuff in nextTick, because bundle may be invalidated
    // if a change happened while compiling
    process.nextTick(() => {
      // check if still in valid state
      if (!context.state) {
        return;
      }

      // print webpack output
      context.options.reporter(context.options, {
        log: context.log,
        state: true,
        stats,
      });

      // execute callback that are delayed
      const { callbacks } = context;

      // eslint-disable-next-line no-param-reassign
      context.callbacks = [];

      callbacks.forEach((cb) => {
        cb(stats);
      });
    });

    // In lazy mode, we may issue another rebuild
    if (context.forceRebuild) {
      // eslint-disable-next-line no-param-reassign
      context.forceRebuild = false;

      context.rebuild();
    }
  }

  context.compiler.hooks.invalid.tap('WebpackDevMiddleware', invalid);
  context.compiler.hooks.run.tap('WebpackDevMiddleware', invalid);
  context.compiler.hooks.done.tap('WebpackDevMiddleware', done);
  context.compiler.hooks.watchRun.tap(
    'WebpackDevMiddleware',
    (comp, callback) => {
      invalid(callback);
    }
  );
}
