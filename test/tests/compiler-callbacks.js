'use strict';

const assert = require('assert');
const sinon = require('sinon'); // eslint-disable-line import/no-extraneous-dependencies
const weblog = require('webpack-log');
const middleware = require('../../');

describe('CompilerCallbacks', () => {
  const hook = { tap: () => {} };
  const logLevel = 'silent';
  const sandbox = sinon.createSandbox();
  const compiler = {
    watch() {},
    hooks: {
      done: hook,
      invalid: hook,
      run: hook,
      watchRun: hook
    }
  };

  afterEach(() => {
    sandbox.restore();
  });

  it('watch error should be reported to console', () => {
    const err = new Error('Oh noes!');
    const stub = sandbox.stub(compiler, 'watch');
    const logger = weblog({ level: logLevel });
    const error = sandbox.spy(logger, 'error');

    stub.callsFake((opts, callback) => {
      callback(err);
    });

    middleware(compiler, { logger });

    assert(error.called);
    assert.equal(error.firstCall.args[0], err.stack);
  });

  it('options.error should be used on watch error', (done) => {
    const stub = sandbox.stub(compiler, 'watch');

    stub.callsFake((opts, callback) => {
      callback(new Error('Oh noes!'));
    });

    middleware(compiler, {
      logger: {
        error(err) {
          assert(/^Error: Oh noes!/.test(err));
          done();
        }
      },
      logLevel: 'silent'
    });
  });
});
