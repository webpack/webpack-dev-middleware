import middleware from '../src';

function fakeWebpack() {
  const hook = { tap: () => {} };
  // mock a compiler, including hooks
  return {
    __test: 'mock compiler - log.js',
    watch() {},
    hooks: {
      done: hook,
      invalid: hook,
      run: hook,
      watchRun: hook,
    },
  };
}

describe('FileSystem', () => {
  it('should set outputFileSystem on compiler', () => {
    const compiler = fakeWebpack();
    middleware(compiler);

    expect(compiler.outputFileSystem).not.toBeUndefined();
  });

  it('should reuse outputFileSystem from compiler', () => {
    const compiler = fakeWebpack();
    middleware(compiler);
    const firstFs = compiler.outputFileSystem;
    middleware(compiler);
    const secondFs = compiler.outputFileSystem;

    expect(firstFs).toEqual(secondFs);
  });

  describe('options.fs', () => {
    // lightweight compiler mock
    const hook = { tap() {} };
    const compiler = {
      outputPath: '/output',
      watch() {},
      hooks: { done: hook, invalid: hook, run: hook, watchRun: hook },
    };

    const fs = { join() {} };

    it('should throw on invalid fs', (done) => {
      expect(() => {
        middleware(compiler, { fs: {} });
      }).toThrow('Invalid options: options.fs.join() method is expected');

      done();
    });

    it('should assign fs to the compiler.outputFileSystem', (done) => {
      const instance = middleware(compiler, { fs });

      expect(compiler.outputFileSystem).toEqual(fs);

      instance.close(done);
    });

    it('should go safely when compiler.outputFileSystem is assigned by fs externally', (done) => {
      const cmplr = Object.create(compiler);
      cmplr.outputFileSystem = fs;
      const instance = middleware(cmplr, { fs });

      expect(cmplr.outputFileSystem).toEqual(fs);

      instance.close(done);
    });
  });

  it('should throw on invalid outputPath config', () => {
    const compiler = fakeWebpack();
    compiler.outputPath = './dist';

    expect(() => {
      middleware(compiler);
    }).toThrow('`output.path` needs to be an absolute path or `/`.');
  });

  it('should not throw on valid outputPath config for Windows', () => {
    const compiler = fakeWebpack();

    compiler.outputPath = 'C:/my/path';

    middleware(compiler);
  });
});
