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
      outputOptions: {},
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
      outputOptions: {
        // eslint-disable-next-line no-undefined
        path: undefined,
        // eslint-disable-next-line no-undefined
        publicPath: undefined,
      },
      url: '/complex/foo.js',
      expected: '/complex/foo.js',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
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
        publicPath: '/complex',
      },
      url: '/complex/foo.js',
      expected: '/foo.js',
    },
    // {
    //  outputOptions: {
    //    path: '/',
    //    publicPath: 'http://localhost:8081/complex/',
    //  },
    //  url: 'http://localhost:8080/complex/foo.js',
    //  expected: false,
    // },
    // {
    //  outputOptions: {
    //    path: '/',
    //    publicPath: 'http://localhost:8080/complex/',
    //  },
    //  url: 'https://localhost:8080/complex/foo.js',
    //  expected: false,
    // },
    // {
    //  outputOptions: {
    //    path: '/',
    //    publicPath: 'http://foo:pass@localhost:8080/complex/',
    //  },
    //  url: 'http://bar:pass@localhost:8080/complex/foo.js',
    //  expected: false,
    // },
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
        path: '/',
        publicPath: '/',
      },
      url: '/test.html?foo=bar#hash',
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
      outputOptions: {
        path: '/a',
        publicPath: '/complex',
      },
      url: '/more/complex/path.js',
      expected: false,
    },
    {
      // publicPath is not in url, so it should fail
      outputOptions: {
        path: '/dist',
        publicPath: '/',
      },
      url: 'c.js',
      expected: false,
    },
    {
      outputOptions: {
        path: '/foo',
        publicPath: '/bar/',
      },
      url: '/bar/',
      expected: '/foo',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: 'http://localhost/foo/',
      },
      url: '/bar/',
      expected: false,
    },
    {
      outputOptions: {
        path: '/',
        publicPath: 'http://localhost:8080/foo/',
      },
      url: '/bar/',
      expected: false,
    },
    {
      outputOptions: {
        path: '/',
        publicPath: 'http://localhost:8080/foo/',
      },
      url: 'http://localhost:8080/foo/index.html',
      expected: '/index.html',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '//localhost:8080/foo/',
      },
      url: '//localhost:8080/foo/index.html',
      expected: '/index.html',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: 'http://localhost:8080/foo/',
      },
      url: 'http://localhost:8080/bar/index.html',
      expected: false,
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '/test/',
      },
      url: 'http://test.domain/test/sample.js',
      expected: '/sample.js',
    },
    // {
    //  outputOptions: {
    //    path: '/',
    //    publicPath: 'http://other.domain/test/',
    //  },
    //  url: 'http://test.domain/test/sample.js',
    //  expected: false,
    // },
    {
      outputOptions: {
        path: '/',
        publicPath: '//test.domain/protocol/relative/',
      },
      url: '/protocol/relative/sample.js',
      expected: '/sample.js',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
      url: '/pathname%20with%20spaces.js',
      expected: '/pathname with spaces.js',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
      url: '/dirname%20with%20spaces/filename%20with%20spaces.js',
      expected: '/dirname with spaces/filename with spaces.js',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
      url: '/dirname%20with%20spaces/filename%20with%20spaces.js',
      expected: '/dirname with spaces/filename with spaces.js',
    },
    {
      outputOptions: {
        path: '/static/',
        publicPath: '/public/',
      },
      url: '/public/foobar/../foo.js',
      expected: '/static/foo.js',
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
      expected: '/foo/sample.js',
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
      expected: '/foo/sample.js',
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
      expected: '/foo/sample.js',
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
      expected: '/bar/sample.css',
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
      expected: '/bar/sample.css',
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
      expected: false,
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
      expected: false,
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
      expected: '/foo/sample.js',
    },
    {
      outputOptions: [
        {
          path: '/foo',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      url: '/css/sample.css',
      expected: '/bar/sample.css',
    },
    {
      outputOptions: [
        {
          publicPath: '/js/',
        },
        {
          path: '/bar',
          publicPath: '/css/',
        },
      ],
      url: '/js/sample.js',
      expected: '/sample.js',
    },
    {
      outputOptions: [
        {
          path: '/foo',
          publicPath: '/js/',
        },
        {
          publicPath: '/css/',
        },
      ],
      url: '/css/sample.css',
      expected: '/sample.css',
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
      expected: '/foo/sample.js',
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
      expected: '/foo/sample.js',
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
      expected: '/bar/sample.css',
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
      expected: '/bar/sample.css',
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
      expected: false,
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
      expected: false,
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
      expected: false,
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
      expected: false,
    },
    {
      outputOptions: {
        path: '/test/#leadinghash',
        publicPath: '/',
      },
      url: '/test/sample.txt',
      expected: '/test/#leadinghash/test/sample.txt',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
      url: '/folder-name-with-dots/mono-v6.x.x',
      expected: '/folder-name-with-dots/mono-v6.x.x',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
      url: '%',
      expected: false,
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '/',
      },
      url: '\uD800',
      expected: false,
    },
    {
      outputOptions: {
        path: '/bar/',
        publicPath: '/foo/',
      },
      url: '/foo/\x46\x6F\x6F',
      expected: '/bar/Foo',
    },
    {
      outputOptions: {
        path: '/',
        publicPath: '/complex/',
      },
      url: 'https://test:malfor%5Med@test.example.com',
      expected: false,
    },
    {
      outputOptions: {
        path: '/',
        publicPath: 'https://test:malfor%5Med@test.example.com',
      },
      url: '/foo/bar',
      expected: false,
    },

    // Windows tests
    {
      condition: isWindows,
      outputOptions: {
        path: 'c:\\foo',
        publicPath: '/test',
      },
      url: '/test/windows.txt',
      expected: 'c:\\foo\\windows.txt',
    },
    // Tests for #284
    {
      condition: isWindows,
      outputOptions: {
        path: 'C:\\My%20Path\\wwwroot',
        publicPath: '/test',
      },
      url: '/test/windows.txt',
      expected: 'C:\\My%20Path\\wwwroot\\windows.txt',
    },
    {
      condition: isWindows,
      outputOptions: {
        path: 'C:\\My%20Path\\wwwroot',
        publicPath: '/test',
      },
      url: '/test/windows%202.txt',
      expected: 'C:\\My%20Path\\wwwroot\\windows 2.txt',
    },
    // Tests for #297
    {
      condition: isWindows,
      outputOptions: {
        path: 'C:\\My Path\\wwwroot',
        publicPath: '/test',
      },
      url: '/test/windows.txt',
      expected: 'C:\\My Path\\wwwroot\\windows.txt',
    },
    {
      condition: isWindows,
      outputOptions: {
        path: 'C:\\My Path\\wwwroot',
        publicPath: '/test',
      },
      url: '/test/windows%202.txt',
      expected: 'C:\\My Path\\wwwroot\\windows 2.txt',
    },
    // Tests for #284 & #297
    {
      condition: isWindows,
      outputOptions: {
        path: 'C:\\My %20 Path\\wwwroot',
        publicPath: '/windows%20test',
      },
      url: '/windows%20test/test%20%26%20test%20%26%20%2520.txt',
      expected: 'C:\\My %20 Path\\wwwroot\\test & test & %20.txt',
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
