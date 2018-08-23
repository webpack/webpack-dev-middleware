'use strict';

const assert = require('assert');
const sinon = require('sinon'); // eslint-disable-line import/no-extraneous-dependencies
const middleware = require('../../');

const doneStats = {
  hasErrors() {
    return false;
  },
  hasWarnings() {
    return false;
  }
};

describe('Lazy mode', () => {
  let instance;
  let next;
  let hooks = {};

  const hook = (name) => {
    return {
      tap: (id, callback) => {
        hooks[name] = callback;
      }
    };
  };
  const logLevel = 'silent';
  const sandbox = sinon.createSandbox();
  const res = {};
  const compiler = {
    hooks: {
      done: hook('done'),
      invalid: hook('invalid'),
      run: hook('run'),
      watchRun: hook('watchRun')
    }
  };

  beforeEach(() => {
    hooks = {};
    compiler.run = sandbox.stub();
    next = sandbox.stub();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('builds', () => {
    const req = { method: 'GET', url: '/bundle.js' };
    beforeEach(() => {
      instance = middleware(compiler, { lazy: true, logLevel });
    });

    it('should trigger build', (done) => {
      instance(req, res, next);
      assert.equal(compiler.run.callCount, 1);
      hooks.done(doneStats);
      setTimeout(() => {
        assert.equal(next.callCount, 1);
        done();
      });
    });

    it('should trigger rebuild when state is invalidated', (done) => {
      hooks.invalid();
      instance(req, res, next);
      hooks.done(doneStats);

      assert.equal(compiler.run.callCount, 1);
      setTimeout(() => {
        assert.equal(next.callCount, 0);
        done();
      });
    });

    it('should pass through compiler error', (done) => {
      const err = new Error('MyCompilerError');
      const { log } = instance.context;
      const spy = sandbox.spy(log, 'error');

      compiler.run.callsArgWith(0, err);

      instance(req, res, next);

      setTimeout(() => {
        assert.equal(spy.callCount, 1);
        assert.equal(spy.calledWith(err.stack), true);

        done();
      }, 1000);
    });
  });

  describe('custom filename', () => {
    it('should trigger build', () => {
      instance = middleware(compiler, { lazy: true, logLevel: 'error', filename: 'foo.js' });

      let req = { method: 'GET', url: '/bundle.js' };
      instance(req, res, next);
      assert.equal(compiler.run.callCount, 0);

      req = { method: 'GET', url: '/foo.js' };
      instance(req, res, next);
      assert.equal(compiler.run.callCount, 1);
    });

    it('should allow prepended slash', () => {
      const options = { lazy: true, logLevel: 'error', filename: '/foo.js' };
      instance = middleware(compiler, options);

      const req = { method: 'GET', url: '/foo.js' };
      instance(req, res, next);
      assert.equal(compiler.run.callCount, 1);
    });
  });
});
