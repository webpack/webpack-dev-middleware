import webpack from 'webpack';
import colorette from 'colorette';

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

      let statsOptions = compiler.compilers
        ? {
            children: compiler.compilers.map((child) =>
              // eslint-disable-next-line no-undefined
              child.options ? child.options.stats : undefined
            ),
          }
        : compiler.options
        ? compiler.options.stats
        : // eslint-disable-next-line no-undefined
          undefined;

      const statsForWebpack4 = webpack.Stats && webpack.Stats.presetToOptions;

      if (compiler.compilers) {
        statsOptions.children = statsOptions.children.map(
          (childStatsOptions) => {
            if (statsForWebpack4) {
              // eslint-disable-next-line no-param-reassign
              childStatsOptions = webpack.Stats.presetToOptions(
                childStatsOptions
              );
            }

            if (typeof childStatsOptions.colors === 'undefined') {
              // eslint-disable-next-line no-param-reassign
              childStatsOptions.colors = Boolean(colorette.options.enabled);
            }

            return childStatsOptions;
          }
        );
      } else if (
        typeof statsOptions.colors === 'undefined' ||
        typeof statsOptions === 'string'
      ) {
        if (statsForWebpack4) {
          statsOptions = webpack.Stats.presetToOptions(statsOptions);
        }

        statsOptions.colors = Boolean(colorette.options.enabled);
      }

      // TODO webpack@4 doesn't support `{ children: [{ colors: true }, { colors: true }] }` for stats
      if (compiler.compilers && statsForWebpack4) {
        statsOptions.colors = statsOptions.children.some(
          (child) => child.colors
        );
      }

      const printedStats = stats.toString(statsOptions);

      // Avoid extra empty line when `stats: 'none'`
      if (printedStats) {
        // eslint-disable-next-line no-console
        console.log(printedStats);
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
