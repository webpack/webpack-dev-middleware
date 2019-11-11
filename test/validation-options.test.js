import webpack from 'webpack';

import middleware from '../src';

import config from './fixtures/simple-config/webpack.config';

describe('validation', () => {
  const tests = {
    logLevel: {
      success: ['info', 'warn', 'error', 'debug', 'trace', 'silent'],
      failure: ['foo'],
    },
    logTime: {
      success: [true, false],
      failure: [0],
    },
    logger: {
      success: [{}],
      failure: ['foo'],
    },
    mimeTypes: {
      success: [{}],
      failure: ['foo'],
    },
    stats: {
      success: [
        {},
        true,
        false,
        'none',
        'errors-only',
        'errors-warnings',
        'minimal',
        'normal',
        'verbose',
      ],
      failure: [0, 'foo'],
    },
    watchOptions: {
      success: [{}],
      failure: [0],
    },
    writeToDisk: {
      success: [true, false, () => {}],
      failure: [{}],
    },
    methods: {
      success: [['foo', 'bar']],
      failure: [{}, true],
    },
    headers: {
      success: [{}],
      failure: [true],
    },
    lazy: {
      success: [true],
      failure: [0],
    },
    publicPath: {
      success: ['foo'],
      failure: [false],
    },
    serverSideRender: {
      success: [true],
      failure: ['foo', 0],
    },
    outputFileSystem: {
      success: [
        {
          join: () => {},
        },
      ],
      failure: [false],
    },
    index: {
      success: [true, false, 'foo'],
      failure: [0, {}],
    },
  };

  function createOptions(key, value) {
    return Object.prototype.toString.call(value) === '[object Object]' &&
      Object.keys(value).length !== 0
      ? value
      : {
          [key]: value,
        };
  }

  for (const [key, values] of Object.entries(tests)) {
    it(`should validate "${key}" option`, async () => {
      const compiler = webpack(config);

      for await (const type of Object.keys(values)) {
        for await (const sample of values[type]) {
          let server;

          try {
            server = middleware(compiler, createOptions(key, sample));

            if (type === 'success') {
              expect(true).toBeTruthy();
            } else {
              expect(false).toBeTruthy();
            }
          } catch (e) {
            if (type === 'success') {
              expect(false).toBeTruthy();
            } else {
              expect(true).toBeTruthy();
            }
          } finally {
            await new Promise((resolve) => {
              if (server) {
                server.close(() => {
                  resolve();
                });
              } else {
                resolve();
              }
            });
          }
        }
      }
    });
  }
});
