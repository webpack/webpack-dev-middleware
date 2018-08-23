'use strict';

/* eslint no-console: off */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const sinon = require('sinon'); // eslint-disable-line import/no-extraneous-dependencies
const middleware = require('../../');
const statOptions = require('../fixtures/stat-options');

const statsPath = path.join(__dirname, '../fixtures', 'stats.txt');
const rawStats = fs.readFileSync(statsPath, 'utf8');

describe('Reporter', () => {
  let hooks = {};
  const hook = (name) => {
    return {
      tap: (id, callback) => {
        hooks[name] = callback;
      }
    };
  };
  const sandbox = sinon.createSandbox();
  const defaults = { logLevel: 'silent' };
  const compiler = {
    watch() {
      return {
        invalidate() {}
      };
    },
    hooks: {
      done: hook('done'),
      invalid: hook('invalid'),
      run: hook('run'),
      watchRun: hook('watchRun')
    }
  };
  const stats = {
    hasErrors() {
      return false;
    },
    hasWarnings() {
      return false;
    },
    toString() {
      return rawStats;
    }
  };

  function spy(instance) {
    const { log } = instance.context;
    sandbox.spy(log, 'info');
    sandbox.spy(log, 'warn');
    sandbox.spy(log, 'error');
  }

  beforeEach(() => {
    // sandbox = sinon.sandbox.create();
    hooks = {};
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should log 'compiled successfully' message", (done) => {
    const instance = middleware(compiler, defaults);
    const { log } = instance.context;

    spy(instance);
    hooks.done(statOptions.basic);

    setTimeout(() => {
      assert.strictEqual(log.info.callCount, 2);
      assert.strictEqual(log.warn.callCount, 0);
      assert.strictEqual(log.error.callCount, 0);
      assert(/Compiled successfully/.test(log.info.lastCall.args[0]));

      instance.context.log = null;
      done();
    });
  });

  it("should log 'Failed to compile' message in error", (done) => {
    const instance = middleware(compiler, defaults);
    const { log } = instance.context;

    spy(instance);
    hooks.done(statOptions.error);

    setTimeout(() => {
      assert.strictEqual(log.info.callCount, 1);
      assert.strictEqual(log.warn.callCount, 0);
      assert.strictEqual(log.error.callCount, 1);
      assert(/Failed to compile/.test(log.info.firstCall.args[0]));
      done();
    });
  });

  it('should log compiled with warnings message', (done) => {
    const instance = middleware(compiler, defaults);
    const { log } = instance.context;

    spy(instance);
    hooks.done(statOptions.warning);

    setTimeout(() => {
      assert.strictEqual(log.info.callCount, 1);
      assert.strictEqual(log.warn.callCount, 1);
      assert.strictEqual(log.error.callCount, 0);
      assert(/Compiled with warnings/.test(log.info.firstCall.args[0]));
      done();
    });
  });

  it('should log invalid message', (done) => {
    const instance = middleware(compiler, defaults);
    const { log } = instance.context;

    spy(instance);
    hooks.done(statOptions.basic);
    hooks.invalid();

    setTimeout(() => {
      assert.strictEqual(log.info.callCount, 1);
      assert(/Compiling\.\.\./.test(log.info.firstCall.args[0]));
      done();
    });
  });

  it('should print stats', (done) => {
    const instance = middleware(compiler, defaults);
    const { log } = instance.context;

    spy(instance);
    hooks.done(stats);

    setTimeout(() => {
      assert.strictEqual(log.info.callCount, 2);
      assert.equal(log.info.firstCall.args[0], stats.toString());
      done();
    });
  });

  it('should not print stats if options.stats is false', (done) => {
    const instance = middleware(compiler, Object.assign(defaults, { stats: false }));
    const { log } = instance.context;

    spy(instance);
    hooks.done(stats);

    setTimeout(() => {
      assert.strictEqual(log.info.callCount, 1);
      done();
    });
  });

  it('should print: wait until bundle valid', (done) => {
    const instance = middleware(compiler, defaults);
    const { log } = instance.context;

    spy(instance);
    hooks.invalid();
    instance.invalidate(function invalid() {}); // eslint-disable-line prefer-arrow-callback

    setTimeout(() => {
      assert.strictEqual(log.info.callCount, 1);
      assert(/wait until bundle finished: invalid/.test(log.info.firstCall.args[0]));
      done();
    });
  });

  it('should allow a custom reporter', (done) => {
    middleware(compiler, {
      reporter(middlewareOptions, options) {
        assert.strictEqual(options.state, true);
        assert(options.stats);
        assert(middlewareOptions);
        done();
      }
    });

    hooks.done(statOptions.basic);
  });
});
