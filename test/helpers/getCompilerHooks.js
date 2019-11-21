export default (compiler) => {
  const result = {};

  for (const hook of Object.keys(compiler.hooks)) {
    for (const tap of compiler.hooks[hook].taps) {
      if (tap.name === 'WebpackDevMiddleware') {
        if (!result[hook]) {
          result[hook] = [];
        }

        result[hook].push(tap);
      }
    }
  }

  return result;
};
