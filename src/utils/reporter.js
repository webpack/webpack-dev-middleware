export default function reporter(context, stats) {
  const { logger, options } = context;

  if (stats) {
    const displayStats = options.stats !== false;
    const statsString = stats.toString(options.stats);

    // displayStats only logged
    if (displayStats && statsString.trim().length) {
      if (stats.hasErrors()) {
        logger.error(statsString);
      } else if (stats.hasWarnings()) {
        logger.warn(statsString);
      } else {
        logger.info(statsString);
      }
    }

    let message = 'Compiled successfully.';

    if (stats.hasErrors()) {
      message = 'Failed to compile.';
    } else if (stats.hasWarnings()) {
      message = 'Compiled with warnings.';
    }

    logger.info(message);
  } else {
    logger.info('Compiling...');
  }
}
