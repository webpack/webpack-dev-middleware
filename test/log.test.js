import weblog from 'webpack-log';

import middleware from '../src';

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
      watchRun: hook,
    },
  };

  function spy(instance) {
    const { log } = instance.context;

    jest.spyOn(log, 'info');
    jest.spyOn(log, 'warn');
    jest.spyOn(log, 'error');
  }

  it('should log', () => {
    const infoSpy = jest.spyOn(console, 'info');
    const warnSpy = jest.spyOn(console, 'warn');
    const errorSpy = jest.spyOn(console, 'error');
    const instance = middleware(compiler, {});
    const { log } = instance.context;

    spy(instance);

    log.info('foo');
    log.warn('foo');
    log.error('foo');

    expect(log.info).toBeCalledTimes(1);
    expect(log.info).toBeCalledWith(expect.stringMatching(/foo/));
    expect(log.warn).toBeCalledTimes(1);
    expect(log.error).toBeCalledTimes(1);

    expect(infoSpy).toBeCalledWith(expect.stringMatching(/foo/));
    expect(warnSpy).toBeCalledWith(expect.stringMatching(/foo/));
    expect(errorSpy).toBeCalledWith(expect.stringMatching(/foo/));
  });

  it('should log with a timestamp', () => {
    // we need to kill this logger as it's cached, and new options won't be
    // applied. isn't something we're going to do in the module, but needed for
    // testing
    weblog.delLogger('wdm');

    const infoSpy = jest.spyOn(console, 'info');
    const instance = middleware(compiler, { logTime: true });
    const { log } = instance.context;

    spy(instance);

    log.info('bar');
    log.warn('bar');
    log.error('bar');

    expect(log.info).toBeCalledTimes(1);
    expect(log.warn).toBeCalledTimes(1);
    expect(log.error).toBeCalledTimes(1);

    expect(log.info).toBeCalledWith(expect.stringMatching(/bar/));
    expect(infoSpy).toBeCalledWith(
      expect.stringMatching(/[\d{2}:\d{2}:\d{2}]/)
    );
  });
});
