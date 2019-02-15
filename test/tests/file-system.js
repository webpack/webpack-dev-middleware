'use strict';

const assert = require('assert');
const middleware = require('../../');

function fakeWebpack() {
  const hook = { tap: () => {} };
  // mock a compiler, including hooks
  const compiler = {
    __test: 'mock compiler - log.js',
    watch() {},
    hooks: {
      done: hook,
      invalid: hook,
      run: hook,
      watchRun: hook
    }
  };

  return compiler;
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

  describe('options.fs', () => {
    // lightweight compiler mock
    const hook = { tap() {} };
    const compiler = {
      outputPath: '/output',
      watch() {},
      hooks: { done: hook, invalid: hook, run: hook, watchRun: hook }
    };

    const fs = { join() {} };

    it('should provide .join()', (done) => {
      try {
        middleware(compiler, { fs });
      } catch (error) {
        done(error);
        return;
      }
      done();
    });

    it('should be assigned to the compiler.outputFileSystem', (done) => {
      const instance = middleware(compiler, { fs });

      assert.equal(compiler.outputFileSystem, fs);
      instance.close(done);
    });
    it('should go safely when compiler.outputFileSystem is assigned by fs externally', (done) => {
      const cmplr = Object.create(compiler);
      cmplr.outputFileSystem = fs;
      const instance = middleware(cmplr, { fs });

      assert.equal(cmplr.outputFileSystem, fs);
      instance.close(done);
    });
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
