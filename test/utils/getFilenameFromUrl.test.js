import getFilenameFromUrl from '../../src/utils/getFilenameFromUrl';

const isWindows = process.platform === 'win32';

function testUrl(test) {
  const context = { options: {} };
  const stats = getStatsMock(test.outputOptions);

  expect(getFilenameFromUrl(context, test.url, stats)).toBe(test.expected);
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
        publicPath: '/',
      },
      url: '/foo.js',
      expected: '/foo.js',
    },
    {
      outputOptions: {
        // eslint-disable-next-line no-undefined
        path: undefined,
        // eslint-disable-next-line no-undefined
        publicPath: undefined,
      },
      url: '/foo.js',
      expected: '/foo.js',
    },
    {
      outputOptions: {},
      url: '/foo.js',
      expected: '/foo.js',
    },
    {
      // Express encodes the URI component, so we do the same
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
      url: '/f%C3%B6%C3%B6.js',
      expected: '/föö.js',
    },
    {
      // Filenames can contain characters not allowed in URIs
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
      url: '/%foo%/%foo%.js',
      expected: '/%foo%/%foo%.js',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: 'http://localhost:8080/',
      },
      url: '/0.19dc5d417382d73dd190.hot-update.js',
      expected: '/0.19dc5d417382d73dd190.hot-update.js',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: 'http://localhost:8080/',
      },
      url: '/bar.js',
      expected: '/bar.js',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
      url: '/test.html?foo=bar',
      expected: '/test.html',
    },
    {
      outputOptions: {
        path: '/dist',
        publicPath: '/',
      },
      url: '/a.js',
      expected: '/dist/a.js',
    },
    {
      outputOptions: {
        path: '/',
        // eslint-disable-next-line no-undefined
        publicPath: undefined,
      },
      url: '/b.js',
      expected: '/b.js',
    },
    {
      outputOptions: {
        // eslint-disable-next-line no-undefined
        path: undefined,
        // eslint-disable-next-line no-undefined
        publicPath: undefined,
      },
      url: '/c.js',
      expected: '/c.js',
    },
    {
      outputOptions: {
        path: '/a',
        publicPath: '/',
      },
      url: '/more/complex/path.js',
      expected: '/a/more/complex/path.js',
    },
    {
      url: '/more/complex/path.js',
      outputOptions: {
        path: '/a',
        publicPath: '/complex',
      },
      expected: false,
    },
    {
      url: 'c.js',
      outputOptions: {
        path: '/dist',
        publicPath: '/',
      },
      // publicPath is not in url, so it should fail
      expected: false,
    },
    {
      url: '/bar/',
      outputOptions: {
        path: '/foo',
        publicPath: '/bar/',
      },
      expected: '/foo',
    },
    {
      url: '/bar/',
      outputOptions: {
        path: '/',
        publicPath: 'http://localhost/foo/',
      },
      expected: false,
    },
    {
      url: 'http://test.domain/test/sample.js',
      outputOptions: {
        path: '/',
        publicPath: '/test/',
      },
      expected: '/sample.js',
    },
    {
      url: 'http://test.domain/test/sample.js',
      outputOptions: {
        path: '/',
        publicPath: 'http://other.domain/test/',
      },
      expected: false,
    },
    {
      url: '/protocol/relative/sample.js',
      outputOptions: {
        path: '/',
        publicPath: '//test.domain/protocol/relative/',
      },
      expected: '/sample.js',
    },
    {
      url: '/pathname%20with%20spaces.js',
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
      expected: '/pathname with spaces.js',
    },
    {
      url: '/js/sample.js',
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
      expected: '/foo/sample.js',
    },
    {
      url: '/js/sample.js',
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
      expected: '/foo/sample.js',
    },
    {
      url: '/css/sample.css',
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
      expected: '/bar/sample.css',
    },
    {
      url: '/css/sample.css',
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
      expected: '/bar/sample.css',
    },
    {
      url: '/other/sample.txt',
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
      expected: false,
    },
    {
      url: '/other/sample.txt',
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
      expected: false,
    },

    {
      url: '/js/sample.js',
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          path: '/bar',
        },
      ],
      expected: '/foo/sample.js',
    },
    {
      url: '/css/sample.css',
      outputOptions: [
        {
          path: '/foo',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      expected: '/bar/sample.css',
    },
    {
      url: '/js/sample.js',
      outputOptions: [
        {
          publicPath: '/js/',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      expected: '/sample.js',
    },
    {
      url: '/css/sample.css',
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          publicPath: '/css/',
        },
      ],
      expected: '/sample.css',
    },
    {
      url: '/js/sample.js',
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
      expected: '/foo/sample.js',
    },
    {
      url: '/js/sample.js',
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
      expected: '/foo/sample.js',
    },
    {
      url: '/css/sample.css',
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
      expected: '/bar/sample.css',
    },
    {
      url: '/css/sample.css',
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
      expected: '/bar/sample.css',
    },
    {
      url: '/other/sample.txt',
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
      expected: false,
    },
    {
      url: '/other/sample.txt',
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
      expected: false,
    },
    {
      url: '/test/sample.txt',
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
      expected: false,
    },
    {
      url: '/test/sample.txt',
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
      expected: false,
    },
    {
      url: '/test/sample.txt',
      outputOptions: {
        path: '/test/#leadinghash',
        publicPath: '/',
      },
      expected: '/test/#leadinghash/test/sample.txt',
    },
    {
      url: '/folder-name-with-dots/mono-v6.x.x',
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
      expected: '/folder-name-with-dots/mono-v6.x.x',
    },
  ];

  for (const test of tests) {
    it(`should process ${test.url} -> ${test.expected}`, () => {
      testUrl(test);
    });
  }

  // Explicit Tests for Microsoft Windows
  if (isWindows) {
    const windowsTests = [
      {
        url: '/test/windows.txt',
        outputOptions: {
          path: 'c:\\foo',
          publicPath: '/test',
        },
        expected: 'c:\\foo/windows.txt',
      },
      // Tests for #284
      {
        url: '/test/windows.txt',
        outputOptions: {
          path: 'C:\\My%20Path\\wwwroot',
          publicPath: '/test',
        },
        expected: 'C:\\My%20Path\\wwwroot/windows.txt',
      },
      {
        url: '/test/windows%202.txt',
        outputOptions: {
          path: 'C:\\My%20Path\\wwwroot',
          publicPath: '/test',
        },
        expected: 'C:\\My%20Path\\wwwroot/windows 2.txt',
      },
      // Tests for #297
      {
        url: '/test/windows.txt',
        outputOptions: {
          path: 'C:\\My Path\\wwwroot',
          publicPath: '/test',
        },
        expected: 'C:\\My Path\\wwwroot/windows.txt',
      },
      {
        url: '/test/windows%202.txt',
        outputOptions: {
          path: 'C:\\My Path\\wwwroot',
          publicPath: '/test',
        },
        expected: 'C:\\My Path\\wwwroot/windows 2.txt',
      },
      // Tests for #284 & #297
      {
        url: '/windows%20test/test%20%26%20test%20%26%20%2520.txt',
        outputOptions: {
          path: 'C:\\My %20 Path\\wwwroot',
          publicPath: '/windows%20test',
        },
        expected: 'C:\\My %20 Path\\wwwroot/test & test & %20.txt',
      },
    ];

    for (const test of windowsTests) {
      it(`windows: should process ${test.url} -> ${test.expected}`, () => {
        testUrl(test);
      });
    }
  }
});
