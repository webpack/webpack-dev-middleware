'use strict';

const weblog = require('webpack-log');

module.exports = function ctx(compiler, options) {
  const context = {
    state: false,
    webpackStats: null,
    callbacks: [],
    options,
    compiler,
    watching: null,
    forceRebuild: false
  };

  if (options.logger) {
    context.log = options.logger;
  } else {
    context.log = weblog({
      level: options.logLevel || 'info',
      name: 'wdm',
      timestamp: options.logTime
    });
  }

  const { log } = context;

  function done(stats) {
    // We are now on valid state
    context.state = true;
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
        log,
        state: true,
        stats
      });

      // execute callback that are delayed
      const cbs = context.callbacks;
      context.callbacks = [];
      cbs.forEach((cb) => {
        cb(stats);
      });
    });

    // In lazy mode, we may issue another rebuild
    if (context.forceRebuild) {
      context.forceRebuild = false;
      rebuild();
    }
  }

  function invalid(...args) {
    if (context.state) {
      context.options.reporter(context.options, {
        log,
        state: false
      });
    }

    // We are now in invalid state
    context.state = false;
    // resolve async
    if (args.length === 2 && typeof args[1] === 'function') {
      const [, callback] = args;
      callback();
    }
  }

  function rebuild() {
    if (context.state) {
      context.state = false;
      context.compiler.run((err) => {
        if (err) {
          log.error(err.stack || err);
          if (err.details) {
            log.error(err.details);
          }
        }
      });
    } else {
      context.forceRebuild = true;
    }
  }

  context.rebuild = rebuild;
  context.compiler.hooks.invalid.tap({name: 'CopyPlugin'}, invalid)
  context.compiler.hooks.run.tap({name: 'CopyPlugin'}, invalid)

  context.compiler.hooks.done.tap({name: 'CopyPlugin'}, (stats) => {
    // clean up the time offset
    if (options.watchOffset > 0) {
      stats.startTime -= options.watchOffset;
    }

    done(stats);
  });

  context.compiler.hooks.watchRun.tap({name: 'CopyPlugin'}, (watcher, callback) => {
    // apply a fix for compiler.watch, if watchOffset is greater than 0:
    //   ff0000-ad-tech/wp-plugin-watch-offset
    // offset start-time
    if (options.watchOffset > 0) {
      watcher.startTime += options.watchOffset;
    }
    invalid(watcher, callback);
  });

  return context;
};
