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

  const statsForWebpack4 = webpack.Stats && webpack.Stats.presetToOptions;

  function normalizeStatsOptions(statsOptions) {
    if (statsForWebpack4) {
      if (typeof statsOptions === 'undefined') {
        // eslint-disable-next-line no-param-reassign
        statsOptions = {};
      } else if (
        typeof statsOptions === 'boolean' ||
        typeof statsOptions === 'string'
      ) {
        // eslint-disable-next-line no-param-reassign
        statsOptions = webpack.Stats.presetToOptions(statsOptions);
      }
    }

    return statsOptions;
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
        ? { children: compiler.compilers.map((child) => child.options.stats) }
        : compiler.options.stats;

      if (compiler.compilers) {
        statsOptions.children = statsOptions.children.map(
          (childStatsOptions) => {
            // eslint-disable-next-line no-param-reassign
            childStatsOptions = normalizeStatsOptions(childStatsOptions);

            if (typeof childStatsOptions.colors === 'undefined') {
              // eslint-disable-next-line no-param-reassign
              childStatsOptions.colors = Boolean(colorette.options.enabled);
            }

            return childStatsOptions;
          }
        );
      } else {
        statsOptions = normalizeStatsOptions(statsOptions);

        if (typeof statsOptions.colors === 'undefined') {
          statsOptions.colors = Boolean(colorette.options.enabled);
        }
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
