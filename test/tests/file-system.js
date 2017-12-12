'use strict';

const assert = require('assert');
const middleware = require('../../');

function fakeWebpack() {
  return {
    watch() {
      return {};
    },
    plugin() {}
  };
}

describe('FileSystem', () => {
  it('should set outputFileSystem on compiler', () => {
    const compiler = fakeWebpack();
    middleware(compiler);
    assert(compiler.outputFileSystem);
  });

  it('should reuse outputFileSystem from compiler', () => {
    const compiler = fakeWebpack();
    middleware(compiler);
    const firstFs = compiler.outputFileSystem;
    middleware(compiler);
    const secondFs = compiler.outputFileSystem;

    assert.equal(firstFs, secondFs);
  });

  it('should throw on invalid outputPath config', () => {
    const compiler = fakeWebpack();
    compiler.outputPath = './dist';
    assert.throws(() => {
      middleware(compiler);
    }, /output\.path/);
  });

  it('should not throw on valid outputPath config for Windows', () => {
    const compiler = fakeWebpack();
    compiler.outputPath = 'C:/my/path';
    middleware(compiler);
  });
});
