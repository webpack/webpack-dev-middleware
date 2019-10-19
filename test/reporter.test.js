/* eslint no-console: off */

import fs from 'fs';
import path from 'path';

import middleware from '../src';

import statOptions from './fixtures/stat-options';

const statsPath = path.join(__dirname, './fixtures', 'stats.txt');
const rawStats = fs.readFileSync(statsPath, 'utf8');

describe('Reporter', () => {
  let hooks = {};
  const hook = (name) => {
    return {
      tap: (id, callback) => {
        hooks[name] = callback;
      },
    };
  };
  const defaults = { logLevel: 'silent' };
  const compiler = {
    watch() {
      return {
        invalidate() {},
      };
    },
    hooks: {
      done: hook('done'),
      invalid: hook('invalid'),
      run: hook('run'),
      watchRun: hook('watchRun'),
    },
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
    },
  };

  function spy(instance) {
    const { log } = instance.context;

    jest.spyOn(log, 'info');
    jest.spyOn(log, 'warn');
    jest.spyOn(log, 'error');
  }

  beforeEach(() => {
    hooks = {};
  });

  it("should log 'compiled successfully' message", (done) => {
    const instance = middleware(compiler, defaults);
    const { log } = instance.context;

    spy(instance);
    hooks.done(statOptions.basic);

    setTimeout(() => {
      expect(log.info).toBeCalledTimes(2);
      expect(log.warn).toBeCalledTimes(0);
      expect(log.error).toBeCalledTimes(0);

      expect(log.info.mock.calls[0][0]).toBe('stats:basic');
      expect(log.info.mock.calls[1][0]).toBe('Compiled successfully.');

      done();
    });
  });

  it("should log 'Failed to compile' message in error", (done) => {
    const instance = middleware(compiler, defaults);
    const { log } = instance.context;

    spy(instance);
    hooks.done(statOptions.error);

    setTimeout(() => {
      expect(log.info).toBeCalledTimes(1);
      expect(log.warn).toBeCalledTimes(0);
      expect(log.error).toBeCalledTimes(1);

      expect(log.info.mock.calls[0][0]).toBe('Failed to compile.');

      done();
    });
  });

  it('should log compiled with warnings message', (done) => {
    const instance = middleware(compiler, defaults);
    const { log } = instance.context;

    spy(instance);
    hooks.done(statOptions.warning);

    setTimeout(() => {
      expect(log.info).toBeCalledTimes(1);
      expect(log.warn).toBeCalledTimes(1);
      expect(log.error).toBeCalledTimes(0);

      expect(log.info.mock.calls[0][0]).toBe('Compiled with warnings.');

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
      expect(log.info).toBeCalledTimes(1);

      expect(log.info.mock.calls[0][0]).toBe('Compiling...');

      done();
    });
  });

  it('should print stats', (done) => {
    const instance = middleware(compiler, defaults);
    const { log } = instance.context;

    spy(instance);
    hooks.done(stats);

    setTimeout(() => {
      expect(log.info).toBeCalledTimes(2);

      expect(log.info.mock.calls[0][0]).toBe(stats.toString());
      expect(log.info.mock.calls[1][0]).toBe('Compiled successfully.');

      done();
    });
  });

  it('should not print stats if options.stats is false', (done) => {
    const instance = middleware(
      compiler,
      Object.assign(defaults, { stats: false })
    );
    const { log } = instance.context;

    spy(instance);
    hooks.done(stats);

    setTimeout(() => {
      expect(log.info).toBeCalledTimes(1);

      expect(log.info.mock.calls[0][0]).toBe('Compiled successfully.');

      done();
    });
  });

  it('should not print stats if options.stats without content', (done) => {
    const statsWithoutContent = Object.assign({}, stats, {
      toString: () => '',
    });
    const instance = middleware(
      compiler,
      Object.assign(defaults, { stats: statsWithoutContent })
    );
    const { log } = instance.context;
    spy(instance);
    hooks.done(statsWithoutContent);

    setTimeout(() => {
      expect(log.info).toBeCalledTimes(1);
      expect(log.info.mock.calls[0][0]).toBe('Compiled successfully.');
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
      expect(log.info).toBeCalledTimes(1);

      expect(log.info.mock.calls[0][0]).toBe(
        'wait until bundle finished: invalid'
      );

      done();
    });
  });

  it('should allow a custom reporter', (done) => {
    middleware(compiler, {
      reporter(middlewareOptions, options) {
        expect(options.state).toBe(true);
        expect(options.stats).toBeDefined();
        expect(middlewareOptions).toBeDefined();

        done();
      },
    });

    hooks.done(statOptions.basic);
  });
});
