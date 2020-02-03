import getFilenameFromUrl from '../../src/utils/getFilenameFromUrl';

const isWindows = process.platform === 'win32';

function testUrl(test) {
  const url = getFilenameFromUrl(test.context, test.url);

  expect(url).toBe(test.expected);
}

describe('GetFilenameFromUrl', () => {
  const tests = [
    {
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          outputPath: '/',
        },
      },
      url: '/foo.js',
      expected: '/foo.js',
    },
    {
      // Express encodes the URI component, so we do the same
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          outputPath: '/',
        },
      },
      url: '/f%C3%B6%C3%B6.js',
      expected: '/föö.js',
    },
    {
      // Filenames can contain characters not allowed in URIs
      url: '/%foo%/%foo%.js',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          outputPath: '/',
        },
      },
      expected: '/%foo%/%foo%.js',
    },
    {
      url: '/0.19dc5d417382d73dd190.hot-update.js',
      context: {
        options: {
          publicPath: 'http://localhost:8080/',
        },
        compiler: {
          outputPath: '/',
        },
      },
      expected: '/0.19dc5d417382d73dd190.hot-update.js',
    },
    {
      url: '/bar.js',
      context: {
        options: {
          publicPath: 'http://localhost:8080/',
        },
        compiler: {
          outputPath: '/',
        },
      },
      expected: '/bar.js',
    },
    {
      url: '/test.html?foo=bar',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          outputPath: '/',
        },
      },
      expected: '/test.html',
    },
    {
      url: '/a.js',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          outputPath: '/dist',
        },
      },
      expected: '/dist/a.js',
    },
    {
      url: '/b.js',
      context: {
        options: {
          // eslint-disable-next-line no-undefined
          publicPath: undefined,
        },
        compiler: {
          outputPath: '/',
        },
      },
      expected: '/b.js',
    },
    {
      url: '/c.js',
      context: {
        options: {
          // eslint-disable-next-line no-undefined
          publicPath: undefined,
        },
        compiler: {
          // eslint-disable-next-line no-undefined
          outputPath: undefined,
        },
      },
      expected: '/c.js',
    },
    {
      url: '/more/complex/path.js',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          outputPath: '/a',
        },
      },
      expected: '/a/more/complex/path.js',
    },
    {
      url: '/more/complex/path.js',
      context: {
        options: {
          publicPath: '/complex',
        },
        compiler: {
          outputPath: '/a',
        },
      },
      expected: false,
    },
    {
      url: 'c.js',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          outputPath: '/dist',
        },
      },
      // publicPath is not in url, so it should fail
      expected: false,
    },
    {
      url: '/bar/',
      context: {
        options: {
          publicPath: '/bar/',
        },
        compiler: {
          outputPath: '/foo',
        },
      },
      expected: '/foo',
    },
    {
      url: '/bar/',
      context: {
        options: {
          publicPath: 'http://localhost/foo/',
        },
        compiler: {
          outputPath: '/',
        },
      },
      expected: false,
    },
    {
      url: 'http://test.domain/test/sample.js',
      context: {
        options: {
          publicPath: '/test/',
        },
        compiler: {
          outputPath: '/',
        },
      },
      expected: '/sample.js',
    },
    {
      url: 'http://test.domain/test/sample.js',
      context: {
        options: {
          publicPath: 'http://other.domain/test/',
        },
        compiler: {
          outputPath: '/',
        },
      },
      expected: false,
    },
    {
      url: '/protocol/relative/sample.js',
      context: {
        options: {
          publicPath: '//test.domain/protocol/relative/',
        },
        compiler: {
          outputPath: '/',
        },
      },
      expected: '/sample.js',
    },
    {
      url: '/pathname%20with%20spaces.js',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          outputPath: '/',
        },
      },
      expected: '/pathname with spaces.js',
    },
    {
      url: '/js/sample.js',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          compilers: [
            { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
            {
              outputPath: '/bar',
              options: { output: { publicPath: '/css/' } },
            },
          ],
          outputPath: '/root',
        },
      },
      expected: '/foo/sample.js',
    },
    {
      url: '/js/sample.js',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
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
        },
      },
      expected: '/foo/sample.js',
    },
    {
      url: '/css/sample.css',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          compilers: [
            { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
            {
              outputPath: '/bar',
              options: { output: { publicPath: '/css/' } },
            },
          ],
          outputPath: '/root',
        },
      },
      expected: '/bar/sample.css',
    },
    {
      url: '/css/sample.css',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
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
        },
      },
      expected: '/bar/sample.css',
    },
    {
      url: '/other/sample.txt',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          compilers: [
            { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
            {
              outputPath: '/bar',
              options: { output: { publicPath: '/css/' } },
            },
          ],
          outputPath: '/root',
        },
      },
      expected: '/root/other/sample.txt',
    },
    {
      url: '/other/sample.txt',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
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
        },
      },
      expected: '/root/other/sample.txt',
    },
    {
      url: '/js/sample.js',
      context: {
        options: {
          publicPath: '/test/',
        },
        compiler: {
          compilers: [
            { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
            {
              outputPath: '/bar',
              options: { output: { publicPath: '/css/' } },
            },
          ],
          outputPath: '/root',
        },
      },
      expected: '/foo/sample.js',
    },
    {
      url: '/js/sample.js',
      context: {
        options: {
          publicPath: '/test/',
        },
        compiler: {
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
        },
      },
      expected: '/foo/sample.js',
    },
    {
      url: '/css/sample.css',
      context: {
        options: {
          publicPath: '/test/',
        },
        compiler: {
          compilers: [
            { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
            {
              outputPath: '/bar',
              options: { output: { publicPath: '/css/' } },
            },
          ],
          outputPath: '/root',
        },
      },
      expected: '/bar/sample.css',
    },
    {
      url: '/css/sample.css',
      context: {
        options: {
          publicPath: '/test/',
        },
        compiler: {
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
        },
      },
      expected: '/bar/sample.css',
    },
    {
      url: '/other/sample.txt',
      context: {
        options: {
          publicPath: '/test/',
        },
        compiler: {
          compilers: [
            { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
            {
              outputPath: '/bar',
              options: { output: { publicPath: '/css/' } },
            },
          ],
          outputPath: '/root',
        },
      },
      expected: false,
    },
    {
      url: '/other/sample.txt',
      context: {
        options: {
          publicPath: '/test/',
        },
        compiler: {
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
        },
      },
      expected: false,
    },
    {
      url: '/test/sample.txt',
      context: {
        options: {
          publicPath: '/test/',
        },
        compiler: {
          compilers: [
            { outputPath: '/foo', options: { output: { publicPath: '/js/' } } },
            {
              outputPath: '/bar',
              options: { output: { publicPath: '/css/' } },
            },
          ],
          outputPath: '/root',
        },
      },
      expected: '/root/sample.txt',
    },
    {
      url: '/test/sample.txt',
      context: {
        options: {
          publicPath: '/test/',
        },
        compiler: {
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
        },
      },
      expected: '/root/sample.txt',
    },
    {
      url: '/test/sample.txt',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          outputPath: '/test/#leadinghash',
        },
      },
      expected: '/test/#leadinghash/test/sample.txt',
    },
    {
      url: '/folder-name-with-dots/mono-v6.x.x',
      context: {
        options: {
          publicPath: '/',
        },
        compiler: {
          outputPath: '/',
        },
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
        context: {
          options: {
            publicPath: '/test',
          },
          compiler: {
            outputPath: 'c:\\foo',
          },
        },
        expected: 'c:\\foo/windows.txt',
      },
      // Tests for #284
      {
        url: '/test/windows.txt',
        context: {
          options: {
            publicPath: '/test',
          },
          compiler: {
            outputPath: 'C:\\My%20Path\\wwwroot',
          },
        },
        expected: 'C:\\My%20Path\\wwwroot/windows.txt',
      },
      {
        url: '/test/windows%202.txt',
        context: {
          options: {
            publicPath: '/test',
          },
          compiler: {
            outputPath: 'C:\\My%20Path\\wwwroot',
          },
        },
        expected: 'C:\\My%20Path\\wwwroot/windows 2.txt',
      },
      // Tests for #297
      {
        url: '/test/windows.txt',
        context: {
          options: {
            publicPath: '/test',
          },
          compiler: {
            outputPath: 'C:\\My Path\\wwwroot',
          },
        },
        expected: 'C:\\My Path\\wwwroot/windows.txt',
      },
      {
        url: '/test/windows%202.txt',
        context: {
          options: {
            publicPath: '/test',
          },
          compiler: {
            outputPath: 'C:\\My Path\\wwwroot',
          },
        },
        expected: 'C:\\My Path\\wwwroot/windows 2.txt',
      },
      // Tests for #284 & #297
      {
        url: '/windows%20test/test%20%26%20test%20%26%20%2520.txt',
        context: {
          options: {
            publicPath: '/windows%20test',
          },
          compiler: {
            outputPath: 'C:\\My %20 Path\\wwwroot',
          },
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
