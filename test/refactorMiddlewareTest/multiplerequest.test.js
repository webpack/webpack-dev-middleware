import path from 'path';

import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '.././helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should work with difference requests', () => {
  let instance;
  let app;
  let listen;

  function listenShorthand(done) {
    return app.listen((error) => {
      if (error) {
        return done(error);
      }

      return done();
    });
  }

  function close(done) {
    if (instance.context.watching.closed) {
      if (listen) {
        listen.close(done);
      } else {
        done();
      }
    }
  }
  const basicOutputPath = path.resolve(__dirname, './outputs/basic');
  const fixtures = [
    {
      urls: [
        {
          value: 'bundle.js',
          contentType: 'application/javascript; charset=utf-8',
          code: 200,
        },
        {
          value: '',
          contentType: 'text/html; charset=utf-8',
          code: 200,
        },
        {
          value: 'index.html',
          contentType: 'text/html; charset=utf-8',
          code: 200,
        },
        {
          value: 'invalid.js',
          contentType: 'text/html; charset=utf-8',
          code: 404,
        },
        {
          value: 'complex',
          contentType: 'text/html; charset=utf-8',
          code: 404,
        },
        {
          value: 'complex/invalid.js',
          contentType: 'text/html; charset=utf-8',
          code: 404,
        },
        {
          value: 'complex/complex',
          contentType: 'text/html; charset=utf-8',
          code: 404,
        },
        {
          value: 'complex/complex/invalid.js',
          contentType: 'text/html; charset=utf-8',
          code: 404,
        },
        {
          value: '%',
          contentType: 'text/html; charset=utf-8',
          code: 404,
        },
      ],
    },
    {
      file: 'config.json',
      data: JSON.stringify({ foo: 'bar' }),
      urls: [
        {
          value: 'config.json',
          contentType: 'application/json; charset=utf-8',
          code: 200,
        },
      ],
    },
    {
      file: 'image.svg',
      data: '<svg>SVG</svg>',
      urls: [
        {
          value: 'image.svg',
          contentType: 'image/svg+xml',
          code: 200,
        },
      ],
    },
    {
      file: 'foo.js',
      data: 'console.log("foo");',
      urls: [
        {
          value: 'foo.js',
          contentType: 'application/javascript; charset=utf-8',
          code: 200,
        },
      ],
    },
    {
      file: '/complex/foo.js',
      data: 'console.log("foo");',
      urls: [
        {
          value: 'complex/foo.js',
          contentType: 'application/javascript; charset=utf-8',
          code: 200,
        },
        {
          value: 'complex/./foo.js',
          contentType: 'application/javascript; charset=utf-8',
          code: 200,
        },
        {
          value: 'complex/foo/../foo.js',
          contentType: 'application/javascript; charset=utf-8',
          code: 200,
        },
      ],
    },
    {
      file: '/complex/complex/foo.js',
      data: 'console.log("foo");',
      urls: [
        {
          value: 'complex/complex/foo.js',
          contentType: 'application/javascript; charset=utf-8',
          code: 200,
        },
      ],
    },
    {
      file: '/föö.js',
      data: 'console.log("foo");',
      urls: [
        // Express encodes the URI component, so we do the same
        {
          value: 'f%C3%B6%C3%B6.js',
          contentType: 'application/javascript; charset=utf-8',
          code: 200,
        },
      ],
    },
    {
      file: '/%foo%/%foo%.js',
      data: 'console.log("foo");',
      urls: [
        // Filenames can contain characters not allowed in URIs
        {
          value: '%foo%/%foo%.js',
          contentType: 'application/javascript; charset=utf-8',
          code: 200,
        },
      ],
    },
    {
      file: 'test.html',
      data: '<div>test</div>',
      urls: [
        {
          value: 'test.html?foo=bar',
          contentType: 'text/html; charset=utf-8',
          code: 200,
        },
        {
          value: 'test.html?foo=bar#hash',
          contentType: 'text/html; charset=utf-8',
          code: 200,
        },
      ],
    },
    {
      file: 'pathname with spaces.js',
      data: 'console.log("foo");',
      urls: [
        {
          value: 'pathname%20with%20spaces.js',
          contentType: 'application/javascript; charset=utf-8',
          code: 200,
        },
      ],
    },
    {
      file: 'dirname with spaces/filename with spaces.js',
      data: 'console.log("foo");',
      urls: [
        {
          value: 'dirname%20with%20spaces/filename%20with%20spaces.js',
          contentType: 'application/javascript; charset=utf-8',
          code: 200,
        },
      ],
    },
    {
      file: 'filename-name-with-dots/mono-v6.x.x',
      data: 'content with .',
      urls: [
        {
          value: 'filename-name-with-dots/mono-v6.x.x',
          contentType: 'application/octet-stream',
          code: 200,
        },
      ],
    },
    {
      file: 'noextension',
      data: 'noextension content',
      urls: [
        {
          value: 'noextension',
          contentType: 'application/octet-stream',
          code: 200,
        },
      ],
    },
    {
      file: '3dAr.usdz',
      data: '3dAr.usdz content',
      urls: [
        {
          value: '3dAr.usdz',
          contentType: 'model/vnd.usdz+zip',
          code: 200,
        },
      ],
    },
    {
      file: 'hello.wasm',
      data: 'hello.wasm content',
      urls: [
        {
          value: 'hello.wasm',
          contentType: 'application/wasm',
          code: 200,
        },
      ],
    },
  ];

  const configurations = [
    {
      output: { path: basicOutputPath, publicPath: '' },
      publicPathForRequest: '/',
    },
    {
      output: { path: path.join(basicOutputPath, 'dist'), publicPath: '' },
      publicPathForRequest: '/',
    },
    {
      output: { path: basicOutputPath, publicPath: '/' },
      publicPathForRequest: '/',
    },
    {
      output: { path: path.join(basicOutputPath, 'dist'), publicPath: '/' },
      publicPathForRequest: '/',
    },
    {
      output: { path: basicOutputPath, publicPath: '/static' },
      publicPathForRequest: '/static/',
    },
    {
      output: {
        path: path.join(basicOutputPath, 'dist'),
        publicPath: '/static',
      },
      publicPathForRequest: '/static/',
    },
    {
      output: { path: basicOutputPath, publicPath: '/static/' },
      publicPathForRequest: '/static/',
    },
    {
      output: {
        path: path.join(basicOutputPath, 'dist'),
        publicPath: '/static/',
      },
      publicPathForRequest: '/static/',
    },
    {
      output: {
        path: path.join(basicOutputPath, 'dist/#leadinghash'),
        publicPath: '/',
      },
      publicPathForRequest: '/',
    },
    {
      output: {
        path: basicOutputPath,
        publicPath: 'http://127.0.0.1/',
      },
      publicPathForRequest: '/',
    },
    {
      output: {
        path: basicOutputPath,
        publicPath: 'http://127.0.0.1:3000/',
      },
      publicPathForRequest: '/',
    },
    {
      output: {
        path: basicOutputPath,
        publicPath: '//test.domain/',
      },
      publicPathForRequest: '/',
    },
  ];

  const isWindows = process.platform === 'win32';

  if (isWindows) {
    fixtures.push(
      {
        file: 'windows.txt',
        data: 'windows.txt content',
        urls: [
          {
            value: 'windows.txt',
            contentType: 'text/plain; charset=utf-8',
            code: 200,
          },
        ],
      },
      {
        file: 'windows 2.txt',
        data: 'windows 2.txt content',
        urls: [
          {
            value: 'windows%202.txt',
            contentType: 'text/plain; charset=utf-8',
            code: 200,
          },
        ],
      },
      {
        file: 'test & test & %20.txt',
        data: 'test & test & %20.txt content',
        urls: [
          {
            value: 'test%20%26%20test%20%26%20%2520.txt',
            contentType: 'text/plain; charset=utf-8',
            code: 200,
          },
        ],
      }
    );

    configurations.push(
      {
        output: {
          path: path.join(basicOutputPath, 'my static'),
          publicPath: '/static/',
        },
        publicPathForRequest: '/static/',
      },
      {
        output: {
          path: path.join(basicOutputPath, 'my%20static'),
          publicPath: '/static/',
        },
        publicPathForRequest: '/static/',
      },
      {
        output: {
          path: path.join(basicOutputPath, 'my %20 static'),
          publicPath: '/my%20static/',
        },
        publicPathForRequest: '/my%20static/',
      }
    );
  }

  for (const configuration of configurations) {
    // eslint-disable-next-line no-loop-func
    describe('should work handle requests', () => {
      const { output, publicPathForRequest } = configuration;
      const { path: outputPath, publicPath } = output;

      let compiler;

      beforeAll((done) => {
        compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: outputPath,
            publicPath,
          },
        });

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        const {
          context: {
            outputFileSystem: { mkdirSync, writeFileSync },
          },
        } = instance;

        for (const { file, data } of fixtures) {
          if (file) {
            const fullPath = path.join(outputPath, file);

            mkdirSync(path.dirname(fullPath), { recursive: true });
            writeFileSync(fullPath, data);
          }
        }
      });

      afterAll(close);

      for (const { data, urls } of fixtures) {
        for (const { value, contentType, code } of urls) {
          // eslint-disable-next-line no-loop-func
          it(`should return the "${code}" code for the "GET" request for the "${value}" url`, (done) => {
            request(app)
              .get(`${publicPathForRequest}${value}`)
              .expect('Content-Type', contentType)
              .expect('Content-Length', data ? String(data.length) : /\d+/)
              .expect(code, done);
          });
        }
      }
    });
  }
});
