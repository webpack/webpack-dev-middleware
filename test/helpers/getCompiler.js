import webpack from 'webpack';

import defaultConfig from '../fixtures/simple-config/webpack.config';

function getCompiler(config) {
  return webpack(config || defaultConfig);
}

export default getCompiler;
