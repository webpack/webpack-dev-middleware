import middleware from '../src';

const doneStats = {
  hasErrors() {
    return false;
  },
  hasWarnings() {
    return false;
  },
};

describe('Lazy mode', () => {
  let instance;
  let next;
  let hooks = {};

  const hook = (name) => {
    return {
      tap: (id, callback) => {
        hooks[name] = callback;
      },
    };
  };
  const logLevel = 'silent';
  const res = {};
  const compiler = {
    hooks: {
      done: hook('done'),
      invalid: hook('invalid'),
      run: hook('run'),
      watchRun: hook('watchRun'),
    },
  };

  beforeEach(() => {
    hooks = {};
    compiler.run = jest.fn();
    next = jest.fn();
  });

  describe('builds', () => {
    const req = { method: 'GET', url: '/bundle.js' };

    beforeEach(() => {
      instance = middleware(compiler, { lazy: true, logLevel });
    });

    it('should trigger build', (done) => {
      instance(req, res, next);

      expect(compiler.run).toBeCalledTimes(1);

      hooks.done(doneStats);

      setTimeout(() => {
        expect(next).toBeCalledTimes(1);

        done();
      });
    });

    it('should trigger rebuild when state is invalidated', () => {
      hooks.invalid();
      instance(req, res, next);
      hooks.done(doneStats);

      expect(compiler.run).toBeCalledTimes(1);
      expect(next).toBeCalledTimes(0);
    });

    it('should pass through compiler error', () => {
      const err = new Error('MyCompilerError');
      const { log } = instance.context;
      const spy = jest.spyOn(log, 'error');

      compiler.run.mockImplementation((callback) => {
        callback(err);
      });

      instance(req, res, next);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toBeCalledWith(err.stack);
    });
  });

  describe('custom filename', () => {
    it('should trigger build', () => {
      instance = middleware(compiler, {
        lazy: true,
        logLevel: 'error',
        filename: 'foo.js',
      });

      let req = { method: 'GET', url: '/bundle.js' };

      instance(req, res, next);

      expect(compiler.run).toBeCalledTimes(0);

      req = { method: 'GET', url: '/foo.js' };
      instance(req, res, next);

      expect(compiler.run).toBeCalledTimes(1);
    });

    it('should allow prepended slash', () => {
      const options = { lazy: true, logLevel: 'error', filename: '/foo.js' };

      instance = middleware(compiler, options);

      const req = { method: 'GET', url: '/foo.js' };

      instance(req, res, next);

      expect(compiler.run).toBeCalledTimes(1);
    });
  });
});
