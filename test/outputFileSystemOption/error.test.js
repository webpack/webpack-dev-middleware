import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should throw an error on the invalid fs value - no join method', () => {
  it('should throw an error', () => {
    expect(() => {
      const compiler = getCompiler(webpackConfig);

      middleware(compiler, { outputFileSystem: { mkdirp: () => {} } });
    }).toThrow(
      'Invalid options: options.outputFileSystem.join() method is expected'
    );
  });
});

describe('should throw an error on the invalid fs value - no mkdirp method', () => {
  it('should throw an error', () => {
    expect(() => {
      const compiler = getCompiler(webpackConfig);

      middleware(compiler, { outputFileSystem: { join: () => {} } });
    }).toThrow(
      'Invalid options: options.outputFileSystem.mkdirp() method is expected'
    );
  });
});
