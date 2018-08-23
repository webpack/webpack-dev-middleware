'use strict';

const assert = require('assert');
const sinon = require('sinon'); // eslint-disable-line import/no-extraneous-dependencies
const weblog = require('webpack-log');
const middleware = require('../../');

// @note logLevel testing is handled by the loglevel module

describe('Logging', () => {
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

  function spy(instance, sandbox) {
    const { log } = instance.context;
    sandbox.spy(log, 'info');
    sandbox.spy(log, 'warn');
    sandbox.spy(log, 'error');
  }

  it('should log', () => {
    const sandbox = sinon.createSandbox();
    const infoSpy = sandbox.spy(console, 'info');
    const warnSpy = sandbox.spy(console, 'warn');
    const errorSpy = sandbox.spy(console, 'error');
    const instance = middleware(compiler, {});
    const { log } = instance.context;

    spy(instance, sandbox);

    log.info('foo');
    log.warn('foo');
    log.error('foo');

    assert.strictEqual(log.info.callCount, 1);
    assert.strictEqual(log.warn.callCount, 1);
    assert.strictEqual(log.error.callCount, 1);
    assert(/foo/.test(log.info.firstCall.args[0]));
    assert(/foo/.test(infoSpy.firstCall.args[0]));
    assert(/foo/.test(warnSpy.firstCall.args[0]));
    assert(/foo/.test(errorSpy.firstCall.args[0]));

    sandbox.restore();
  });

  it('should log with a timestamp', () => {
    // we need to kill this logger as it's cached, and new options won't be
    // applied. isn't something we're going to do in the module, but needed for
    // testing
    weblog.delLogger('wdm');

    const sandbox = sinon.createSandbox();
    const info = sandbox.spy(console, 'info');
    const instance = middleware(compiler, { logTime: true });
    const { log } = instance.context;

    spy(instance, sandbox);

    log.info('bar');
    log.warn('bar');
    log.error('bar');

    assert.strictEqual(log.info.callCount, 1);
    assert.strictEqual(log.warn.callCount, 1);
    assert.strictEqual(log.error.callCount, 1);
    assert(/bar/.test(log.info.firstCall.args[0]));

    assert(/[\d{2}:\d{2}:\d{2}]/.test(info.firstCall.args[0]));

    sandbox.restore();
  });
});
