import middleware from '../src';

import getCompiler from './helpers/getCompiler';

// Suppress unnecessary stats output
global.process.stdout.write = jest.fn();

describe('validation', () => {
  const cases = {
    mimeTypes: {
      success: [{ phtml: ['text/html'] }],
      failure: ['foo'],
    },
    writeToDisk: {
      success: [true, false, () => {}],
      failure: [{}],
    },
    methods: {
      success: [['GET', 'HEAD']],
      failure: [{}, true],
    },
    headers: {
      success: [{ 'X-Custom-Header': 'yes' }],
      failure: [true],
    },
    publicPath: {
      success: ['/foo', '', 'auto', () => '/public/path'],
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
  };

  function stringifyValue(value) {
    if (
      Array.isArray(value) ||
      (value && typeof value === 'object' && value.constructor === Object)
    ) {
      return JSON.stringify(value);
    }

    return value;
  }

  async function close(webpackDevMiddleware) {
    return new Promise((resolve) => {
      if (webpackDevMiddleware) {
        webpackDevMiddleware.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async function createTestCase(key, value, type) {
    it(`should ${
      type === 'success' ? 'successfully validate' : 'throw an error on'
    } the "${key}" option with "${stringifyValue(value)}" value`, async () => {
      const compiler = getCompiler();

      let webpackDevMiddleware;
      let error;

      try {
        webpackDevMiddleware = middleware(compiler, { [key]: value });
      } catch (maybeError) {
        if (maybeError.name !== 'ValidationError') {
          throw maybeError;
        }

        error = maybeError;
      } finally {
        if (type === 'success') {
          expect(error).toBeUndefined();
        } else if (type === 'failure') {
          expect(() => {
            throw error;
          }).toThrowErrorMatchingSnapshot();
        }

        await close(webpackDevMiddleware);
      }
    });
  }

  for (const [key, values] of Object.entries(cases)) {
    for (const type of Object.keys(values)) {
      for (const value of values[type]) {
        createTestCase(key, value, type);
      }
    }
  }
});
