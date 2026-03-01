/** @typedef {import("webpack").Configuration} Configuration */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */

/** @typedef {Configuration["stats"]} StatsOptions */
/** @typedef {{ children: Configuration["stats"][] }} MultiStatsOptions */
/** @typedef {Exclude<Configuration["stats"], boolean | string | undefined>} StatsObjectOptions */

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").WithOptional<import("../index.js").Context<Request, Response>, "watching" | "outputFileSystem">} context context
 */
function setupHooks(context) {
  /**
   * @returns {void}
   */
  function invalid() {
    if (context.state) {
      context.logger.log("Compilation starting...");
    }

    // We are now in invalid state

    context.state = false;

    context.stats = undefined;

    // Notify EventStream clients about compilation starting
    if (context.eventStream) {
      context.eventStream.publish({ action: "building" });
    }
  }

  /**
   * @param {StatsOptions} statsOptions stats options
   * @returns {StatsObjectOptions} object stats options
   */
  function normalizeStatsOptions(statsOptions) {
    if (typeof statsOptions === "undefined") {
      statsOptions = { preset: "normal" };
    } else if (typeof statsOptions === "boolean") {
      statsOptions = statsOptions ? { preset: "normal" } : { preset: "none" };
    } else if (typeof statsOptions === "string") {
      statsOptions = { preset: statsOptions };
    }

    return statsOptions;
  }

  /**
   * @param {Stats | MultiStats} stats stats
   */
  function done(stats) {
    // We are now on valid state

    context.state = true;

    context.stats = stats;

    // Do the stuff in nextTick, because bundle may be invalidated if a change happened while compiling
    process.nextTick(() => {
      const { compiler, logger, options, state, callbacks } = context;

      // Check if still in valid state
      if (!state) {
        return;
      }

      logger.log("Compilation finished");

      const isMultiCompilerMode = Boolean(
        /** @type {MultiCompiler} */
        (compiler).compilers,
      );

      /**
       * @type {StatsOptions | MultiStatsOptions | undefined}
       */
      let statsOptions;

      if (typeof options.stats !== "undefined") {
        statsOptions = isMultiCompilerMode
          ? {
              children:
                /** @type {MultiCompiler} */
                (compiler).compilers.map(() => options.stats),
            }
          : options.stats;
      } else {
        statsOptions = isMultiCompilerMode
          ? {
              children:
                /** @type {MultiCompiler} */
                (compiler).compilers.map((child) => child.options.stats),
            }
          : /** @type {Compiler} */ (compiler).options.stats;
      }

      if (isMultiCompilerMode) {
        /** @type {MultiStatsOptions} */
        (statsOptions).children =
          /** @type {MultiStatsOptions} */
          (statsOptions).children.map(
            /**
             * @param {StatsOptions} childStatsOptions child stats options
             * @returns {StatsObjectOptions} object child stats options
             */
            (childStatsOptions) => {
              childStatsOptions = normalizeStatsOptions(childStatsOptions);

              if (typeof childStatsOptions.colors === "undefined") {
                const [firstCompiler] =
                  /** @type {MultiCompiler} */
                  (compiler).compilers;

                childStatsOptions.colors =
                  firstCompiler.webpack.cli.isColorSupported();
              }

              return childStatsOptions;
            },
          );
      } else {
        statsOptions = normalizeStatsOptions(
          /** @type {StatsOptions} */ (statsOptions),
        );

        if (typeof statsOptions.colors === "undefined") {
          const { compiler } = /** @type {{ compiler: Compiler }} */ (context);
          statsOptions.colors = compiler.webpack.cli.isColorSupported();
        }
      }

      const printedStats = stats.toString(
        /** @type {StatsObjectOptions} */
        (statsOptions),
      );

      // Avoid extra empty line when `stats: 'none'`
      if (printedStats) {
        // eslint-disable-next-line no-console
        console.log(printedStats);
      }

      // Notify EventStream clients about compilation completion
      if (context.eventStream) {
        const statsData = stats.toJson({
          all: false,
          hash: true,
          assets: false,
          warnings: true,
          errors: true,
          errorDetails: false,
        });

        context.eventStream.publish({
          action: "built",
          time: statsData.time,
          hash: statsData.hash,
          warnings: statsData.warnings || [],
          errors: statsData.errors || [],
          modules: statsData.modules,
        });
      }

      context.callbacks = [];

      // Execute callback that are delayed
      for (const callback of callbacks) {
        callback(stats);
      }
    });
  }

  // eslint-disable-next-line prefer-destructuring
  const compiler =
    /** @type {import("../index.js").Context<Request, Response>} */
    (context).compiler;

  compiler.hooks.watchRun.tap("webpack-dev-middleware", invalid);
  compiler.hooks.invalid.tap("webpack-dev-middleware", invalid);
  compiler.hooks.done.tap("webpack-dev-middleware", done);
}

module.exports = setupHooks;
