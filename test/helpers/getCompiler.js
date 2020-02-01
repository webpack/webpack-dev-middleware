import webpack from 'webpack';

import defaultConfig from '../fixtures/server-test/webpack.simple.config';

function getCompiler(config) {
  return webpack(config || defaultConfig);
}

export default getCompiler;
