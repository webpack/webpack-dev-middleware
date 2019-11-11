import getFilenameFromUrl from '../../src/utils/getFilenameFromUrl';

const isWindows = process.platform === 'win32';

function testUrl(options) {
  const url = getFilenameFromUrl(options.publicPath, options, options.url);

  expect(url).toBe(options.expected);
}

describe('GetFilenameFromUrl', () => {
  const tests = [
    {
      url: '/foo.js',
      outputPath: '/',
      publicPath: '/',
      expected: '/foo.js',
    },
    {
      // Express encodes the URI component, so we do the same
      url: '/f%C3%B6%C3%B6.js',
      outputPath: '/',
      publicPath: '/',
      expected: '/föö.js',
    },
    {
      // Filenames can contain characters not allowed in URIs
      url: '/%foo%/%foo%.js',
      outputPath: '/',
      publicPath: '/',
      expected: '/%foo%/%foo%.js',
    },
    {
      url: '/0.19dc5d417382d73dd190.hot-update.js',
      outputPath: '/',
      publicPath: 'http://localhost:8080/',
      expected: '/0.19dc5d417382d73dd190.hot-update.js',
    },
    {
      url: '/bar.js',
      outputPath: '/',
      publicPath: 'https://localhost:8080/',
      expected: '/bar.js',
    },
    {
      url: '/test.html?foo=bar',
      outputPath: '/',
      publicPath: '/',
      expected: '/test.html',
    },
    {
      url: '/a.js',
      outputPath: '/dist',
      publicPath: '/',
      expected: '/dist/a.js',
    },
    {
      url: '/b.js',
      outputPath: '/',
      // eslint-disable-next-line no-undefined
      publicPath: undefined,
      expected: '/b.js',
    },
    {
      url: '/c.js',
      // eslint-disable-next-line no-undefined
      outputPath: undefined,
      // eslint-disable-next-line no-undefined
      publicPath: undefined,
      expected: '/c.js',
    },
    {
      url: '/more/complex/path.js',
      outputPath: '/a',
      publicPath: '/',
      expected: '/a/more/complex/path.js',
    },
    {
      url: '/more/complex/path.js',
      outputPath: '/a',
      publicPath: '/complex',
      expected: false,
    },
    {
      url: 'c.js',
      outputPath: '/dist',
      publicPath: '/',
      // publicPath is not in url, so it should fail
      expected: false,
    },
    {
      url: '/bar/',
      outputPath: '/foo',
      publicPath: '/bar/',
      expected: '/foo',
    },
    {
      url: '/bar/',
      outputPath: '/',
      publicPath: 'http://localhost/foo/',
      expected: false,
    },
    {
      url: 'http://test.domain/test/sample.js',
      outputPath: '/',
      publicPath: '/test/',
      expected: '/sample.js',
    },
    {
      url: 'http://test.domain/test/sample.js',
      outputPath: '/',
      publicPath: 'http://other.domain/test/',
      expected: false,
    },
    {
      url: '/protocol/relative/sample.js',
      outputPath: '/',
      publicPath: '//test.domain/protocol/relative/',
      expected: '/sample.js',
    },
    {
      url: '/pathname%20with%20spaces.js',
      outputPath: '/',
      publicPath: '/',
      expected: '/pathname with spaces.js',
    },
    {
      url: '/js/sample.js',
      compilers: [
        { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
        { outputPath: '/bar', options: { output: { publicPath: '/css/' } } },
      ],
      outputPath: '/root',
      publicPath: '/',
      expected: '/foo/sample.js',
    },
    {
      url: '/js/sample.js',
      compilers: [
        {
          outputPath: '/foo',
          options: { output: { publicPath: 'http://localhost/js/' } },
        },
        {
          outputPath: '/bar',
          options: { output: { publicPath: 'http://localhost/css/' } },
        },
      ],
      outputPath: '/root',
      publicPath: '/',
      expected: '/foo/sample.js',
    },
    {
      url: '/css/sample.css',
      compilers: [
        { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
        { outputPath: '/bar', options: { output: { publicPath: '/css/' } } },
      ],
      outputPath: '/root',
      publicPath: '/',
      expected: '/bar/sample.css',
    },
    {
      url: '/css/sample.css',
      compilers: [
        {
          outputPath: '/foo',
          options: { output: { publicPath: 'http://localhost/js/' } },
        },
        {
          outputPath: '/bar',
          options: { output: { publicPath: 'http://localhost/css/' } },
        },
      ],
      outputPath: '/root',
      publicPath: '/',
      expected: '/bar/sample.css',
    },
    {
      url: '/other/sample.txt',
      compilers: [
        { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
        { outputPath: '/bar', options: { output: { publicPath: '/css/' } } },
      ],
      outputPath: '/root',
      publicPath: '/',
      expected: '/root/other/sample.txt',
    },
    {
      url: '/other/sample.txt',
      compilers: [
        {
          outputPath: '/foo',
          options: { output: { publicPath: 'http://localhost/js/' } },
        },
        {
          outputPath: '/bar',
          options: { output: { publicPath: 'http://localhost/css/' } },
        },
      ],
      outputPath: '/root',
      publicPath: '/',
      expected: '/root/other/sample.txt',
    },
    {
      url: '/js/sample.js',
      compilers: [
        { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
        { outputPath: '/bar', options: { output: { publicPath: '/css/' } } },
      ],
      outputPath: '/root',
      publicPath: '/test/',
      expected: '/foo/sample.js',
    },
    {
      url: '/js/sample.js',
      compilers: [
        {
          outputPath: '/foo',
          options: { output: { publicPath: 'http://localhost/js/' } },
        },
        {
          outputPath: '/bar',
          options: { output: { publicPath: 'http://localhost/css/' } },
        },
      ],
      outputPath: '/root',
      publicPath: '/test/',
      expected: '/foo/sample.js',
    },
    {
      url: '/css/sample.css',
      compilers: [
        { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
        { outputPath: '/bar', options: { output: { publicPath: '/css/' } } },
      ],
      outputPath: '/root',
      publicPath: '/test/',
      expected: '/bar/sample.css',
    },
    {
      url: '/css/sample.css',
      compilers: [
        {
          outputPath: '/foo',
          options: { output: { publicPath: 'http://localhost/js/' } },
        },
        {
          outputPath: '/bar',
          options: { output: { publicPath: 'http://localhost/css/' } },
        },
      ],
      outputPath: '/root',
      publicPath: '/test/',
      expected: '/bar/sample.css',
    },
    {
      url: '/other/sample.txt',
      compilers: [
        { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
        { outputPath: '/bar', options: { output: { publicPath: '/css/' } } },
      ],
      outputPath: '/root',
      publicPath: '/test/',
      expected: false,
    },
    {
      url: '/other/sample.txt',
      compilers: [
        {
          outputPath: '/foo',
          options: { output: { publicPath: 'http://localhost/js/' } },
        },
        {
          outputPath: '/bar',
          options: { output: { publicPath: 'http://localhost/css/' } },
        },
      ],
      outputPath: '/root',
      publicPath: '/test/',
      expected: false,
    },
    {
      url: '/test/sample.txt',
      compilers: [
        { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
        { outputPath: '/bar', options: { output: { publicPath: '/css/' } } },
      ],
      outputPath: '/root',
      publicPath: '/test/',
      expected: '/root/sample.txt',
    },
    {
      url: '/test/sample.txt',
      compilers: [
        {
          outputPath: '/foo',
          options: { output: { publicPath: 'http://localhost/js/' } },
        },
        {
          outputPath: '/bar',
          options: { output: { publicPath: 'http://localhost/css/' } },
        },
      ],
      outputPath: '/root',
      publicPath: '/test/',
      expected: '/root/sample.txt',
    },
    {
      url: '/test/sample.txt',
      outputPath: '/test/#leadinghash',
      publicPath: '/',
      expected: '/test/#leadinghash/test/sample.txt',
    },
    {
      url: '/folder-name-with-dots/mono-v6.x.x',
      outputPath: '/',
      publicPath: '/',
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
        outputPath: 'c:\\foo',
        publicPath: '/test',

        expected: 'c:\\foo/windows.txt',
      },
      // Tests for #284
      {
        url: '/test/windows.txt',
        outputPath: 'C:\\My%20Path\\wwwroot',
        publicPath: '/test',
        expected: 'C:\\My%20Path\\wwwroot/windows.txt',
      },
      {
        url: '/test/windows%202.txt',
        outputPath: 'C:\\My%20Path\\wwwroot',
        publicPath: '/test',
        expected: 'C:\\My%20Path\\wwwroot/windows 2.txt',
      },
      // Tests for #297
      {
        url: '/test/windows.txt',
        outputPath: 'C:\\My Path\\wwwroot',
        publicPath: '/test',
        expected: 'C:\\My Path\\wwwroot/windows.txt',
      },
      {
        url: '/test/windows%202.txt',
        outputPath: 'C:\\My Path\\wwwroot',
        publicPath: '/test',
        expected: 'C:\\My Path\\wwwroot/windows 2.txt',
      },
      // Tests for #284 & #297
      {
        url: '/windows%20test/test%20%26%20test%20%26%20%2520.txt',
        outputPath: 'C:\\My %20 Path\\wwwroot',
        publicPath: '/windows%20test',
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
