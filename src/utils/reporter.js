export default function reporter(context, stats) {
  const { logger, compiler } = context;

  if (stats) {
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
  } else {
    logger.info('Compiling...');
  }
}
