import getFilenameFromUrl from '../../src/utils/getPossibleFilePaths';

const isWindows = process.platform === 'win32';

function testUrl(test) {
  const context = { options: {} };
  const stats = getStatsMock(test.outputOptions);

  let { expected } = test;

  if (isWindows) {
    expected = expected.map((item) => item.replace(/\//g, '\\'));
  }

  expect(getFilenameFromUrl(context, test.url, stats)).toEqual(expected);
}

function getStatsMock(outputOptions) {
  if (Array.isArray(outputOptions)) {
    return {
      stats: outputOptions.map((item) => {
        return {
          compilation: { getPath: (path) => path, outputOptions: item },
        };
      }),
    };
  }

  return {
    compilation: { getPath: (path) => path, outputOptions },
  };
}

describe('GetFilenameFromUrl', () => {
  const tests = [
    {
      outputOptions: {
        path: '/',
        publicPath: 'http://localhost:8080/foo/',
      },
      url: 'http://localhost:8080/foo/index.html',
      expected: ['/index.html'],
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '//localhost:8080/foo/',
      },
      url: '//localhost:8080/foo/index.html',
      expected: ['/index.html'],
    },
    {
      outputOptions: {
        path: '/',
        publicPath: 'http://localhost:8080/foo/',
      },
      url: 'http://localhost:8080/bar/index.html',
      expected: [],
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '/test/',
      },
      url: 'http://test.domain/test/sample.js',
      expected: ['/sample.js'],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      url: '/js/sample.js',
      expected: ['/foo/sample.js'],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: 'http://localhost/js/',
        },
        {
          path: '/bar',
          publicPath: 'http://localhost/css/',
        },
      ],
      url: '/js/sample.js',
      expected: ['/foo/sample.js'],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: 'http://localhost/css/',
        },
        {
          path: '/bar',
          publicPath: 'http://localhost/css/',
        },
      ],
      url: '/css/sample.js',
      expected: ['/foo/sample.js', '/bar/sample.js'],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      url: '/css/sample.css',
      expected: ['/bar/sample.css'],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: 'http://localhost/js/',
        },
        {
          path: '/bar',
          publicPath: 'http://localhost/css/',
        },
      ],
      url: '/css/sample.css',
      expected: ['/bar/sample.css'],
    },
    {
      outputOptions: [
        {
          path: '/one',
          publicPath: 'http://localhost/one/',
        },
        {
          path: '/two',
          publicPath: 'http://localhost/two/',
        },
        {
          path: '/three',
          publicPath: 'http://localhost/three/',
        },
        {
          path: '/four',
          publicPath: 'http://localhost/four/',
        },
      ],
      url: '/five/sample.css',
      expected: [],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      url: '/other/sample.txt',
      expected: [],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: 'http://localhost/js/',
        },
        {
          path: '/bar',
          publicPath: 'http://localhost/css/',
        },
      ],
      url: '/other/sample.txt',
      expected: [],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          path: '/bar',
        },
      ],
      url: '/js/sample.js',
      expected: ['/foo/sample.js', '/bar/js/sample.js'],
    },
    {
      outputOptions: [
        {
          path: '/bar',
          publicPath: '/css/',
        },
        {
          path: '/foo',
          publicPath: '',
        },
      ],
      url: '/css/sample.css',
      expected: ['/bar/sample.css', '/foo/css/sample.css'],
    },
    {
      outputOptions: [
        {
          path: '/',
          publicPath: '/js/',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      url: '/js/sample.js',
      expected: ['/sample.js'],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          path: '/',
          publicPath: '/css/',
        },
      ],
      url: '/css/sample.css',
      expected: ['/sample.css'],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      url: '/js/sample.js',
      expected: ['/foo/sample.js'],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: 'http://localhost/js/',
        },
        {
          path: '/bar',
          publicPath: 'http://localhost/css/',
        },
      ],
      url: '/js/sample.js',
      expected: ['/foo/sample.js'],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      url: '/css/sample.css',
      expected: ['/bar/sample.css'],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: 'http://localhost/js/',
        },
        {
          path: '/bar',
          publicPath: 'http://localhost/css/',
        },
      ],
      url: '/css/sample.css',
      expected: ['/bar/sample.css'],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      url: '/other/sample.txt',
      expected: [],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: 'http://localhost/js/',
        },
        {
          path: '/bar',
          publicPath: 'http://localhost/css/',
        },
      ],
      url: '/other/sample.txt',
      expected: [],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      url: '/test/sample.txt',
      expected: [],
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: 'http://localhost/js/',
        },
        {
          path: '/bar',
          publicPath: 'http://localhost/css/',
        },
      ],
      url: '/test/sample.txt',
      expected: [],
    },

    // Windows tests
    {
      condition: isWindows,
      outputOptions: {
        path: 'c:\\foo',
        publicPath: '/test',
      },
      url: '/test/windows.txt',
      expected: ['c:\\foo\\windows.txt'],
    },
    // Tests for #284
    {
      condition: isWindows,
      outputOptions: {
        path: 'C:\\My%20Path\\wwwroot',
        publicPath: '/test',
      },
      url: '/test/windows.txt',
      expected: ['C:\\My%20Path\\wwwroot\\windows.txt'],
    },
    {
      condition: isWindows,
      outputOptions: {
        path: 'C:\\My%20Path\\wwwroot',
        publicPath: '/test',
      },
      url: '/test/windows%202.txt',
      expected: ['C:\\My%20Path\\wwwroot\\windows 2.txt'],
    },
    // Tests for #297
    {
      condition: isWindows,
      outputOptions: {
        path: 'C:\\My Path\\wwwroot',
        publicPath: '/test',
      },
      url: '/test/windows.txt',
      expected: ['C:\\My Path\\wwwroot\\windows.txt'],
    },
    {
      condition: isWindows,
      outputOptions: {
        path: 'C:\\My Path\\wwwroot',
        publicPath: '/test',
      },
      url: '/test/windows%202.txt',
      expected: ['C:\\My Path\\wwwroot\\windows 2.txt'],
    },
    // Tests for #284 & #297
    {
      condition: isWindows,
      outputOptions: {
        path: 'C:\\My %20 Path\\wwwroot',
        publicPath: '/windows%20test',
      },
      url: '/windows%20test/test%20%26%20test%20%26%20%2520.txt',
      expected: ['C:\\My %20 Path\\wwwroot\\test & test & %20.txt'],
    },
  ];

  for (const test of tests) {
    if (
      typeof test.condition === 'undefined' ||
      (typeof test.condition !== 'undefined' && test.condition)
    ) {
      it(`should process ${test.url} -> ${test.expected}`, () => {
        testUrl(test);
      });
    }
  }
});
