import fs from 'fs';
import path from 'path';

import express from 'express';
import request from 'supertest';
import MemoryFileSystem from 'memory-fs';

import middleware from '../src';

import getCompiler from './helpers/getCompiler';

import { mockRequest, mockResponse } from './mock-express';

import webpackConfig from './fixtures/server-test/webpack.config';
import webpackMultiConfig from './fixtures/server-test/webpack.array.config';
import webpackQuerystringConfig from './fixtures/server-test/webpack.querystring.config';
import webpackClientServerConfig from './fixtures/server-test/webpack.client.server.config';
import webpackErrorConfig from './fixtures/error-config/webpack.config';
import webpackWarningConfig from './fixtures/warning-config/webpack.config';

describe('middleware', () => {
  let instance;
  let listen;
  let app;

  const logLevel = 'error';

  function listenShorthand(done) {
    return app.listen(8000, '127.0.0.1', (err) => {
      if (err) {
        return done(err);
      }

      return done();
    });
  }

  function close(done) {
    instance.close();

    if (listen) {
      listen.close(done);
    } else {
      done();
    }
  }

  describe('basic', () => {
    describe('should work with difference requests', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: '/',
          },
        });

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          publicPath: '/public/',
          mimeTypes: {
            typeMap: {
              'model/vnd.pixar.usd': ['usdz'],
            },
            force: true,
          },
        });

        app.use(instance);

        listen = listenShorthand(done);

        // Hack to add a mock HMR json file to the in-memory outputFileSystem.
        instance.context.outputFileSystem.writeFileSync(
          '/123a123412.hot-update.json',
          '["hi"]'
        );
        // Add a nested directory and index.html inside
        instance.context.outputFileSystem.mkdirSync('/reference');
        instance.context.outputFileSystem.mkdirSync('/reference/mono-v6.x.x');
        instance.context.outputFileSystem.writeFileSync(
          '/reference/mono-v6.x.x/index.html',
          'My Index.'
        );
        instance.context.outputFileSystem.writeFileSync(
          '/hello.wasm',
          'welcome'
        );
        instance.context.outputFileSystem.writeFileSync('/3dAr.usdz', '010101');
      });

      afterAll((done) => {
        close(done);
      });

      it('should not find a bundle file on disk', (done) => {
        request(app)
          .get('/public/bundle.js')
          .expect(200, () => {
            const bundlePath = path.join(
              __dirname,
              '../fixtures/server-test/bundle.js'
            );
            expect(fs.existsSync(bundlePath)).toBe(false);
            done();
          });
      });

      it('GET request to bundle file', (done) => {
        const bundleData = instance.context.outputFileSystem.readFileSync(
          '/bundle.js'
        );
        const contentLength = bundleData.byteLength.toString();

        request(app)
          .get('/public/bundle.js')
          .expect('Content-Length', contentLength)
          .expect('Content-Type', 'application/javascript; charset=UTF-8')
          .expect(200, bundleData.toString(), done);
      });

      it('HEAD request to bundle file', (done) => {
        const contentLength = instance.context.outputFileSystem
          .readFileSync('/bundle.js')
          .byteLength.toString();

        request(app)
          .head('/public/bundle.js')
          .expect('Content-Length', contentLength)
          .expect('Content-Type', 'application/javascript; charset=UTF-8')
          // eslint-disable-next-line no-undefined
          .expect(200, undefined, done);
      });

      it('POST request to bundle file', (done) => {
        request(app)
          .post('/public/bundle.js')
          .expect(404, done);
      });

      it('request to image', (done) => {
        const contentLength = instance.context.outputFileSystem
          .readFileSync('/svg.svg')
          .byteLength.toString();

        request(app)
          .get('/public/svg.svg')
          .expect('Content-Length', contentLength)
          .expect('Content-Type', 'image/svg+xml; charset=UTF-8')
          .expect(200, done);
      });

      it('request to non existing file', (done) => {
        request(app)
          .get('/public/nope')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(404, done);
      });

      it('request to HMR json', (done) => {
        const manifestData = instance.context.outputFileSystem.readFileSync(
          '/123a123412.hot-update.json'
        );
        const contentLength = manifestData.byteLength.toString();

        request(app)
          .get('/public/123a123412.hot-update.json')
          .expect('Content-Length', contentLength)
          .expect('Content-Type', 'application/json; charset=UTF-8')
          .expect(200, manifestData.toString(), done);
      });

      it('request to directory', (done) => {
        request(app)
          .get('/public/')
          .expect('Content-Type', 'text/html; charset=UTF-8')
          .expect('Content-Length', '10')
          .expect(200, /My Index\./, done);
      });

      it('request to subdirectory without trailing slash', (done) => {
        const fileData = instance.context.outputFileSystem.readFileSync(
          '/reference/mono-v6.x.x/index.html'
        );
        const contentLength = fileData.byteLength.toString();

        request(app)
          .get('/public/reference/mono-v6.x.x')
          .expect('Content-Length', contentLength)
          .expect('Content-Type', 'text/html; charset=UTF-8')
          .expect(200, fileData.toString(), done);
      });

      it('invalid range header', (done) => {
        request(app)
          .get('/public/svg.svg')
          .set('Range', 'bytes=6000-')
          .expect(416, done);
      });

      it('valid range header', (done) => {
        request(app)
          .get('/public/svg.svg')
          .set('Range', 'bytes=3000-3500')
          .expect('Content-Length', '501')
          .expect('Content-Range', 'bytes 3000-3500/4778')
          .expect(206, done);
      });

      it('request to non-public path', (done) => {
        request(app)
          .get('/nonpublic/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(404, done);
      });

      it('request to hello.wasm', (done) => {
        const fileData = instance.context.outputFileSystem.readFileSync(
          '/hello.wasm'
        );
        const contentLength = fileData.byteLength.toString();

        request(app)
          .get('/public/hello.wasm')
          .expect('Content-Length', contentLength)
          .expect('Content-Type', 'application/wasm')
          .expect(200, fileData.toString(), done);
      });

      it('request to 3dAr.usdz', (done) => {
        const fileData = instance.context.outputFileSystem.readFileSync(
          '/3dAr.usdz'
        );
        const contentLength = fileData.byteLength.toString();

        request(app)
          .get('/public/3dAr.usdz')
          .expect('Content-Length', contentLength)
          .expect('Content-Type', 'model/vnd.pixar.usd')
          .expect('010101')
          .expect(200, fileData.toString(), done);
      });
    });

    // Issue #385, for that koa-webpack@4.x doesn't pass in res.getHeader method.
    describe('should work when res.getHeader is undefined', () => {
      it('should not throw error', (done) => {
        const req = mockRequest({
          url: '/',
          method: 'GET',
          headers: {
            Range: 'bytes=6000-',
          },
        });

        const res = mockResponse({
          // eslint-disable-next-line no-undefined
          getHeader: undefined,
          setHeader: jest.fn(),
        });

        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
        });

        instance(req, res, jest.fn()).then(done);
      });

      afterAll(close);
    });

    describe('should respect the "Content-Type" from other middleware', () => {
      beforeAll((done) => {
        app = express();

        app.use((req, res, next) => {
          res.set('Content-Type', 'application/octet-stream');
          next();
        });

        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
        });

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('Do not guess mime type if Content-Type header is found', (done) => {
        request(app)
          .get('/bundle.js')
          .expect('Content-Type', 'application/octet-stream')
          .expect(200, done);
      });
    });

    describe('should not throw error on valid outputPath config for linux', () => {
      it('no error', (done) => {
        expect(() => {
          const compiler = getCompiler();

          compiler.outputPath = '/my/path';

          instance = middleware(compiler);

          instance.close(done);
        }).not.toThrow();
      });
    });

    describe('should not throw error on valid outputPath config for windows', () => {
      it('no error', (done) => {
        expect(() => {
          const compiler = getCompiler();

          compiler.outputPath = 'C:/my/path';

          instance = middleware(compiler);

          instance.close(done);
        }).not.toThrow();
      });
    });

    describe('should throw error on invalid outputPath config', () => {
      it('error with "/"', () => {
        const compiler = getCompiler();

        compiler.outputPath = './dist';

        expect(() => {
          middleware(compiler);
        }).toThrow('`output.path` needs to be an absolute path or `/`.');
      });

      it('error with "\\"', () => {
        const compiler = getCompiler();

        compiler.outputPath = '.\\dist';

        expect(() => {
          middleware(compiler);
        }).toThrow('`output.path` needs to be an absolute path or `/`.');
      });
    });
  });

  describe('multi compiler', () => {
    describe('should works', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler(webpackMultiConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          publicPath: '/',
        });

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('request to both bundle files', (done) => {
        request(app)
          .get('/js1/foo.js')
          .expect(200, () => {
            request(app)
              .get('/js2/bar.js')
              .expect(200, done);
          });
      });
    });

    describe('should works with one "publicPath"', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler(webpackClientServerConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
        });

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('request to bundle file', (done) => {
        request(app)
          .get('/static/foo.js')
          .expect(200, done);
      });

      it('request to nonexistent file', (done) => {
        request(app)
          .get('/static/invalid.js')
          .expect(404, done);
      });

      it('request to non-public path', (done) => {
        request(app)
          .get('/')
          .expect(404, done);
      });
    });
  });

  describe('mimeTypes option', () => {
    describe('custom extensions', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: '/',
          },
        });

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          index: 'Index.phtml',
          mimeTypes: {
            'text/html': ['phtml'],
          },
        });

        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.writeFileSync(
          '/Index.phtml',
          'welcome'
        );
      });

      afterAll(close);

      it('request to Index.phtml', (done) => {
        request(app)
          .get('/')
          .expect('welcome')
          .expect('Content-Type', /text\/html/)
          .expect(200, done);
      });
    });

    describe('force option for overriding any previous mapping', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: '/',
          },
        });

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          index: 'Index.phtml',
          mimeTypes: {
            typeMap: { 'text/html': ['phtml'] },
            force: true,
          },
        });

        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.writeFileSync(
          '/Index.phtml',
          'welcome'
        );
      });

      afterAll(close);

      it('request to Index.phtml', (done) => {
        request(app)
          .get('/')
          .expect('welcome')
          .expect('Content-Type', /text\/html/)
          .expect(200, done);
      });
    });
  });

  describe('watchOptions option', () => {
    let compiler;
    let spy;

    const watchOptions = {
      aggregateTimeout: 300,
      poll: 1000,
    };

    beforeAll((done) => {
      app = express();

      compiler = getCompiler(webpackConfig);

      spy = jest.spyOn(compiler, 'watch');

      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        watchOptions,
      });

      app.use(instance);

      listen = listenShorthand(done);
    });

    afterAll(close);

    it('should pass to "watch" method', (done) => {
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toEqual(watchOptions);

      spy.mockRestore();

      done();
    });
  });

  describe('writeToDisk option', () => {
    function writeToDisk(value, done) {
      app = express();

      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        writeToDisk: value,
      });

      app.use(instance);
      app.use((req, res) => {
        res.sendStatus(200);
      });

      listen = listenShorthand(done);

      return { compiler, instance, app };
    }

    function querystringToDisk(value, done) {
      app = express();

      const compiler = getCompiler(webpackQuerystringConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        writeToDisk: value,
      });

      app.use(instance);
      app.use((req, res) => {
        res.sendStatus(200);
      });

      listen = listenShorthand(done);

      return { compiler, instance, app };
    }

    function multiToDisk(value, done) {
      app = express();

      const compiler = getCompiler(webpackMultiConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        writeToDisk: value,
      });

      app.use(instance);
      app.use((req, res) => {
        res.sendStatus(200);
      });

      listen = listenShorthand(done);

      return { compiler, instance, app };
    }

    describe('with "true" value', () => {
      let compiler;

      beforeAll((done) => {
        ({ compiler } = writeToDisk(true, done));
      });

      afterAll(close);

      it('should find the bundle file on disk', (done) => {
        request(app)
          .get('/foo/bar')
          .expect(200, () => {
            const bundlePath = path.join(
              __dirname,
              './fixtures/server-test/bundle.js'
            );

            expect(
              compiler.hooks.assetEmitted.taps.filter(
                (hook) => hook.name === 'WebpackDevMiddleware'
              ).length
            ).toBe(1);
            expect(fs.existsSync(bundlePath)).toBe(true);

            fs.unlinkSync(bundlePath);

            instance.invalidate();

            compiler.hooks.done.tap(
              'WebpackDevMiddlewareWriteToDiskTest',
              () => {
                expect(
                  compiler.hooks.assetEmitted.taps.filter(
                    (hook) => hook.name === 'WebpackDevMiddleware'
                  ).length
                ).toBe(1);

                done();
              }
            );
          });
      });
    });

    describe('with "false" value', () => {
      let compiler;

      beforeAll((done) => {
        ({ compiler } = writeToDisk(false, done));
      });

      afterAll(close);

      it('should not find the bundle file on disk', (done) => {
        request(app)
          .get('/foo/bar')
          .expect(200, () => {
            const bundlePath = path.join(
              __dirname,
              './fixtures/server-test/bundle.js'
            );

            expect(
              compiler.hooks.assetEmitted.taps.filter(
                (hook) => hook.name === 'WebpackDevMiddleware'
              ).length
            ).toBe(0);
            expect(fs.existsSync(bundlePath)).toBe(false);

            instance.invalidate();

            compiler.hooks.done.tap(
              'WebpackDevMiddlewareWriteToDiskTest',
              () => {
                expect(
                  compiler.hooks.assetEmitted.taps.filter(
                    (hook) => hook.name === 'WebpackDevMiddleware'
                  ).length
                ).toBe(0);

                done();
              }
            );
          });
      });
    });

    describe('with "function" that returns truthy', () => {
      beforeAll((done) => {
        writeToDisk((filePath) => /bundle\.js$/.test(filePath), done);
      });

      afterAll(close);

      it('should find the bundle file on disk', (done) => {
        request(app)
          .get('/foo/bar')
          .expect(200, () => {
            const bundlePath = path.join(
              __dirname,
              './fixtures/server-test/bundle.js'
            );

            expect(fs.existsSync(bundlePath)).toBe(true);

            fs.unlinkSync(bundlePath);

            done();
          });
      });
    });

    describe('with "function" that returns falsy', () => {
      beforeAll((done) => {
        writeToDisk((filePath) => !/bundle\.js$/.test(filePath), done);
      });

      afterAll(close);

      it('should not find the bundle file on disk', (done) => {
        request(app)
          .get('/foo/bar')
          .expect(200, () => {
            const bundlePath = path.join(
              __dirname,
              './fixtures/server-test/bundle.js'
            );

            expect(fs.existsSync(bundlePath)).toBe(false);

            done();
          });
      });
    });

    describe('should work when asset has querystrings', () => {
      beforeAll((done) => {
        querystringToDisk(true, done);
      });

      afterAll(close);

      it('should find the bundle file on disk with no querystring', (done) => {
        request(app)
          .get('/foo/bar')
          .expect(200, () => {
            const bundlePath = path.join(
              __dirname,
              './fixtures/server-test/bundle.js'
            );

            expect(fs.existsSync(bundlePath)).toBe(true);

            fs.unlinkSync(bundlePath);

            done();
          });
      });
    });

    describe('should work in multi compiler mode', () => {
      beforeAll((done) => {
        multiToDisk(true, done);
      });

      afterAll(close);

      it('should find the bundle files on disk', (done) => {
        request(app)
          .get('/foo/bar')
          .expect(200, () => {
            const bundleFiles = [
              './fixtures/server-test/js1/foo.js',
              './fixtures/server-test/js1/index.html',
              './fixtures/server-test/js1/svg.svg',
              './fixtures/server-test/js2/bar.js',
            ];

            for (const bundleFile of bundleFiles) {
              const bundlePath = path.join(__dirname, bundleFile);

              expect(fs.existsSync(bundlePath)).toBe(true);

              fs.unlinkSync(bundlePath);
            }

            fs.rmdirSync(path.join(__dirname, './fixtures/server-test/js1/'));
            fs.rmdirSync(path.join(__dirname, './fixtures/server-test/js2/'));

            done();
          });
      });
    });
  });

  describe('methods option', () => {
    beforeAll((done) => {
      app = express();

      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        methods: ['POST'],
        logLevel,
        publicPath: '/public/',
      });

      app.use(instance);

      listen = listenShorthand(done);
    });

    afterAll(close);

    it("POST request to bundle file with methods set to ['POST']", (done) => {
      request(app)
        .post('/public/bundle.js')
        .expect('Content-Type', 'application/javascript; charset=UTF-8')
        .expect(200, /console\.log\('Hey\.'\)/, done);
    });

    it("GET request to bundle file with methods set to ['POST']", (done) => {
      request(app)
        .get('/public/bundle.js')
        .expect(404, done);
    });

    it("HEAD request to bundle file with methods set to ['POST']", (done) => {
      request(app)
        .get('/public/bundle.js')
        .expect(404, done);
    });
  });

  describe('headers option', () => {
    beforeAll((done) => {
      app = express();

      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        headers: { 'X-nonsense-1': 'yes', 'X-nonsense-2': 'no' },
      });

      app.use(instance);

      listen = listenShorthand(done);
    });

    afterAll(close);

    it('request to bundle file and custom headers exists', (done) => {
      request(app)
        .get('/bundle.js')
        .expect('X-nonsense-1', 'yes')
        .expect('X-nonsense-2', 'no')
        .expect(200, done);
    });
  });

  describe('lazy option', () => {
    describe('with unspecified value', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          lazy: false,
          publicPath: '/',
        });

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('GET request to bundle file', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, /console\.log\('Hey\.'\)/, done);
      });
    });

    describe('with "false" value', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          lazy: false,
          publicPath: '/',
        });

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('GET request to bundle file', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, /console\.log\('Hey\.'\)/, done);
      });
    });

    describe('with "true" value', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          lazy: true,
          publicPath: '/',
        });

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('GET request to bundle file', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, /console\.log\('Hey\.'\)/, done);
      });
    });
  });

  describe('publicPath option', () => {
    describe('with "string" value', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: '/',
          },
        });

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          publicPath: '/public/',
        });

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll((done) => {
        close(done);
      });

      it('GET request to bundle file', (done) => {
        request(app)
          .get('/public/bundle.js')
          .expect('Content-Type', 'application/javascript; charset=UTF-8')
          .expect(200, /console\.log\('Hey\.'\)/, done);
      });
    });
  });

  describe('serverSideRender option', () => {
    let locals;

    beforeAll((done) => {
      app = express();

      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        serverSideRender: true,
      });

      app.use(instance);
      app.use((req, res) => {
        // eslint-disable-next-line prefer-destructuring
        locals = res.locals;

        res.sendStatus(200);
      });

      listen = listenShorthand(done);
    });

    afterAll(close);

    it('request to bundle file', (done) => {
      request(app)
        .get('/foo/bar')
        .expect(200, () => {
          expect(locals.webpack.stats).toBeDefined();
          expect(locals.webpack.outputFileSystem).toBeDefined();

          done();
        });
    });
  });

  describe('fs option', () => {
    describe('with unspecified value', () => {
      let compiler;

      beforeAll((done) => {
        app = express();

        compiler = getCompiler(webpackConfig);

        instance = middleware(compiler);

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should use "MemoryFileSystem" by default', () => {
        expect(compiler.outputFileSystem instanceof MemoryFileSystem).toBe(
          true
        );
        expect(
          instance.context.outputFileSystem instanceof MemoryFileSystem
        ).toBe(true);
      });
    });

    describe('with "MemoryFileSystem" value on compiler', () => {
      let compiler;

      beforeAll((done) => {
        app = express();

        compiler = getCompiler(webpackConfig);

        compiler.outputFileSystem = new MemoryFileSystem();

        instance = middleware(compiler);

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should use "outputFileSystem" from compiler', () => {
        expect(compiler.outputFileSystem instanceof MemoryFileSystem).toBe(
          true
        );
        expect(
          instance.context.outputFileSystem instanceof MemoryFileSystem
        ).toBe(true);
      });
    });

    describe('with configured value', () => {
      const configuredFs = fs;

      configuredFs.join = path.join;

      let compiler;

      beforeAll((done) => {
        app = express();

        compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          outputFileSystem: configuredFs,
        });

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should use MemoryFileSystem by default', () => {
        expect(compiler.outputFileSystem).toEqual(configuredFs);
        expect(instance.context.outputFileSystem).toEqual(configuredFs);
      });
    });

    describe('should throw error on invalid fs', () => {
      it('without "join" method', () => {
        expect(() => {
          const compiler = getCompiler(webpackConfig);

          middleware(compiler, { outputFileSystem: {} });
        }).toThrow(
          'Invalid options: options.outputFileSystem.join() method is expected'
        );
      });
    });
  });

  describe('index option', () => {
    describe('with "false" value', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          index: false,
          publicPath: '/',
        });

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('request to directory', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(404, done);
      });
    });

    describe('with "true" value', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          index: true,
          publicPath: '/',
        });

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('request to directory', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'text/html; charset=UTF-8')
          .expect(200, done);
      });
    });

    describe('with "string" value', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: '/',
          },
        });

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          index: 'index.custom',
          mimeTypes: {
            'text/html': ['custom'],
          },
          publicPath: '/',
        });

        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.writeFileSync(
          '/index.custom',
          'hello'
        );
      });

      afterAll(close);

      it('request to directory', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'text/html; charset=UTF-8')
          .expect(200, done);
      });
    });

    describe('with "string" value without extension', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: '/',
          },
        });

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          index: 'noextension',
        });

        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.writeFileSync(
          '/noextension',
          'hello'
        );
      });

      afterAll(close);

      it('request to noextension', (done) => {
        request(app)
          .get('/')
          .expect('hello')
          .expect('Content-Type', '; charset=UTF-8')
          .expect(200, done);
      });
    });

    describe('with "string" value but index is directory', () => {
      beforeAll((done) => {
        app = express();

        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: '/',
          },
        });

        instance = middleware(compiler, {
          stats: 'errors-only',
          logLevel,
          index: 'custom.html',
          publicPath: '/',
        });

        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync('/custom.html');
      });

      afterAll(close);

      it('request to directory', (done) => {
        request(app)
          .get('/')
          .expect(404, done);
      });
    });
  });

  describe('logger', () => {
    function normalizeLogs(logs) {
      if (Array.isArray(logs)) {
        return logs.map((log) => normalizeLogs(log));
      }

      return logs.toString().trim();
    }

    describe('should log on successfully build', () => {
      let compiler;

      const loggerMock = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      beforeAll((done) => {
        app = express();

        compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: '/',
          },
        });

        instance = middleware(compiler, {
          stats: 'errors-warnings',
          logLevel: 'info',
        });

        instance.context.log = loggerMock;

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('logs', (done) => {
        request(app)
          .get('/bundle.js')
          .expect('Content-Type', 'application/javascript; charset=UTF-8')
          .expect(200, /console\.log\('Hey\.'\)/, () => {
            instance.invalidate();

            instance.waitUntilValid(() => {
              expect(
                normalizeLogs(loggerMock.debug.mock.calls)
              ).toMatchSnapshot('debug');
              expect(normalizeLogs(loggerMock.info.mock.calls)).toMatchSnapshot(
                'info'
              );
              expect(normalizeLogs(loggerMock.warn.mock.calls)).toMatchSnapshot(
                'warn'
              );
              expect(
                normalizeLogs(loggerMock.error.mock.calls)
              ).toMatchSnapshot('error');

              done();
            });
          });
      });
    });

    describe('should log on unsuccessful build', () => {
      let compiler;
      const loggerMock = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      beforeAll((done) => {
        app = express();

        compiler = getCompiler({
          ...webpackErrorConfig,
          output: {
            filename: 'bundle.js',
            path: '/',
          },
        });

        instance = middleware(compiler, {
          stats: 'errors-warnings',
          logLevel: 'info',
        });

        instance.context.log = loggerMock;

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('logs', (done) => {
        request(app)
          .get('/bundle.js')
          .expect('Content-Type', 'application/javascript; charset=UTF-8')
          .expect(200, /console\.log\('Hey\.'\)/, () => {
            instance.invalidate();

            instance.waitUntilValid(() => {
              expect(
                normalizeLogs(loggerMock.debug.mock.calls)
              ).toMatchSnapshot('debug');
              expect(normalizeLogs(loggerMock.info.mock.calls)).toMatchSnapshot(
                'info'
              );
              expect(normalizeLogs(loggerMock.warn.mock.calls)).toMatchSnapshot(
                'warn'
              );
              expect(
                normalizeLogs(loggerMock.error.mock.calls)
              ).toMatchSnapshot('error');

              done();
            });
          });
      });
    });

    describe('should log on warning build', () => {
      let compiler;
      const loggerMock = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      beforeAll((done) => {
        app = express();

        compiler = getCompiler({
          ...webpackWarningConfig,
          output: {
            filename: 'bundle.js',
            path: '/',
          },
        });

        instance = middleware(compiler, {
          stats: 'errors-warnings',
          logLevel: 'info',
        });

        instance.context.log = loggerMock;

        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('logs', (done) => {
        request(app)
          .get('/bundle.js')
          .expect('Content-Type', 'application/javascript; charset=UTF-8')
          .expect(200, /console\.log\('Hey\.'\)/, () => {
            instance.invalidate();

            instance.waitUntilValid(() => {
              expect(
                normalizeLogs(loggerMock.debug.mock.calls)
              ).toMatchSnapshot('debug');
              expect(normalizeLogs(loggerMock.info.mock.calls)).toMatchSnapshot(
                'info'
              );
              expect(normalizeLogs(loggerMock.warn.mock.calls)).toMatchSnapshot(
                'warn'
              );
              expect(
                normalizeLogs(loggerMock.error.mock.calls)
              ).toMatchSnapshot('error');

              done();
            });
          });
      });
    });

    describe('should log error in "watch" method', () => {
      it('on startup', () => {
        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: '/',
          },
        });

        const watchSpy = jest
          .spyOn(compiler, 'watch')
          .mockImplementation((watchOptions, callback) => {
            const error = new Error('Error in Watch method');

            error.stack = '';

            callback(error);
          });

        const loggerMock = {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };

        instance = middleware(compiler, {
          stats: 'errors-only',
          logger: loggerMock,
          logLevel: 'silent',
        });

        expect(normalizeLogs(loggerMock.debug.mock.calls)).toMatchSnapshot(
          'debug'
        );
        expect(normalizeLogs(loggerMock.info.mock.calls)).toMatchSnapshot(
          'info'
        );
        expect(normalizeLogs(loggerMock.warn.mock.calls)).toMatchSnapshot(
          'warn'
        );
        expect(normalizeLogs(loggerMock.error.mock.calls)).toMatchSnapshot(
          'error'
        );

        instance.close();

        watchSpy.mockRestore();
      });
    });
  });
});
