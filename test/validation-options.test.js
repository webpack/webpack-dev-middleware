import middleware from '../src';

import getCompiler from './helpers/getCompiler';

describe('validation', () => {
  const tests = {
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
          mkdirp: () => {},
        },
      ],
      failure: [false],
    },
    index: {
      success: [true, false, 'foo'],
      failure: [0, {}],
    },
    filename: {
      success: ['foo.js'],
      failure: [0, {}],
    },
  };

  for (const [key, values] of Object.entries(tests)) {
    it(`should validate "${key}" option`, async () => {
      const compiler = getCompiler();

      for await (const type of Object.keys(values)) {
        for await (const sample of values[type]) {
          let server;

          try {
            server = middleware(compiler, { [key]: sample });

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
