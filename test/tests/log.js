'use strict';

const assert = require('assert');
const sinon = require('sinon'); // eslint-disable-line import/no-extraneous-dependencies
const middleware = require('../../');

// @note logLevel testing is handled by the loglevel module

describe('Logging', () => {
  const plugins = {};
  const compiler = {
    watch() {},
    plugin(name, callback) {
      plugins[name] = callback;
    }
  };

  function spy(instance, sandbox) {
    const { log } = instance.context;
    sandbox.spy(log, 'info');
    sandbox.spy(log, 'warn');
    sandbox.spy(log, 'error');
  }

  it('should log', () => {
    const sandbox = sinon.sandbox.create();
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
    const sandbox = sinon.sandbox.create();
    const infoSpy = sandbox.spy(console, 'info');
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
    assert(/[\d{2}:\d{2}:\d{2}]/.test(infoSpy.firstCall.args[0]));

    sandbox.restore();
  });
});
