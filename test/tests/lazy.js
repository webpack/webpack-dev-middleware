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
  let plugins = [];
  const res = {};
  const compiler = {
    plugin(name, callback) {
      plugins[name] = callback;
    }
  };
  let instance;
  let next;

  beforeEach(() => {
    plugins = {};
    compiler.run = sinon.stub();
    next = sinon.stub();
  });

  describe('builds', () => {
    const req = { method: 'GET', url: '/bundle.js' };
    beforeEach(() => {
      instance = middleware(compiler, { lazy: true, logLevel: 'silent' });
    });

    it('should trigger build', (done) => {
      instance(req, res, next);
      assert.equal(compiler.run.callCount, 1);
      plugins.done(doneStats);
      setTimeout(() => {
        assert.equal(next.callCount, 1);
        done();
      });
    });

    it('should trigger rebuild when state is invalidated', (done) => {
      plugins.invalid();
      instance(req, res, next);
      plugins.done(doneStats);

      assert.equal(compiler.run.callCount, 1);
      setTimeout(() => {
        assert.equal(next.callCount, 0);
        done();
      });
    });

    it('should pass through compiler error', (done) => {
      const err = new Error('MyCompilerError');
      const { log } = instance.context;
      const spy = sinon.spy(log, 'error');

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
