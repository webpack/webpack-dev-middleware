import middleware from '../src';

const options = {
  publicPath: '/public/',
};

describe('API', () => {
  let closeCount = 0;
  let hooks = {};
  let invalidationCount = 0;

  // TODO: Should use sinon or something for this...
  const hook = (name) => {
    return {
      tap: (id, callback) => {
        hooks[name] = callback;
      },
    };
  };
  const compiler = {
    outputPath: '/output',
    getInfrastructureLogger: () => ({
      info: () => {},
    }),
    watch() {
      return {
        invalidate() {
          invalidationCount += 1;
        },
        close(callback) {
          closeCount += 1;
          callback();
        },
      };
    },
    hooks: {
      done: hook('done'),
      invalid: hook('invalid'),
      run: hook('run'),
      watchRun: hook('watchRun'),
    },
  };

  beforeEach(() => {
    hooks = {};
    invalidationCount = 0;
    closeCount = 0;
  });

  const doneStats = {
    hasErrors() {
      return false;
    },
    hasWarnings() {
      return false;
    },
  };

  describe('waitUntilValid', () => {
    it('should wait for bundle done', (done) => {
      let doneCalled = false;
      const instance = middleware(compiler, options);
      instance.waitUntilValid(() => {
        if (doneCalled) {
          done();
        } else {
          done(new Error('`waitUntilValid` called before bundle was done'));
        }
      });
      setTimeout(() => {
        hooks.done(doneStats);
        doneCalled = true;
      });
    });

    it('callback should be called when bundle is already done', (done) => {
      const instance = middleware(compiler, options);
      hooks.done(doneStats);
      setTimeout(() => {
        instance.waitUntilValid(() => {
          done();
        });
      });
    });

    it('should work without callback', () => {
      const instance = middleware(compiler, options);
      hooks.done(doneStats);
      setTimeout(() => {
        instance.waitUntilValid();
      });
    });

    it('callback should have stats argument', (done) => {
      const instance = middleware(compiler, options);
      hooks.done(doneStats);
      setTimeout(() => {
        instance.waitUntilValid((stats) => {
          const keys = Object.keys(stats);
          expect(keys.includes('hasErrors')).toBe(true);
          expect(keys.includes('hasWarnings')).toBe(true);
          done();
        });
      });
    });
  });

  describe('invalidate', () => {
    it('should use callback immediately when in lazy mode', (done) => {
      const instance = middleware(compiler, { lazy: true });
      instance.invalidate(done);
    });

    it('should wait for bundle done', (done) => {
      const instance = middleware(compiler, options);
      let doneCalled = false;
      instance.invalidate(() => {
        if (doneCalled) {
          expect(invalidationCount).toBe(1);
          done();
        } else {
          done(new Error('`invalid` called before bundle was done'));
        }
      });
      setTimeout(() => {
        hooks.done(doneStats);
        doneCalled = true;
      });
    });

    it('should work without callback', (done) => {
      const instance = middleware(compiler, options);
      instance.invalidate();
      setTimeout(() => {
        expect(invalidationCount).toBe(1);
        done();
      });
    });
  });

  describe('close', () => {
    it('should use callback immediately when in lazy mode', (done) => {
      const instance = middleware(compiler, { lazy: true });
      instance.close(done);
    });

    it('should call close on watcher', (done) => {
      const instance = middleware(compiler, options);
      instance.close(() => {
        expect(closeCount).toBe(1);
        done();
      });
    });

    it('should call close on watcher without callback', () => {
      const instance = middleware(compiler, options);
      instance.close();
      expect(closeCount).toBe(1);
    });
  });

  describe('getFilenameFromUrl', () => {
    it('use publicPath and compiler.outputPath to parse the filename', (done) => {
      const instance = middleware(compiler, options);
      const filename = instance.getFilenameFromUrl('/public/index.html');

      expect(filename).toBe('/output/index.html');

      instance.close(done);
    });
  });
});
