import fs from 'fs';
import path from 'path';

import express from 'express';
import request from 'supertest';
import memfs, { createFsFromVolume, Volume } from 'memfs';

import middleware from '../src';

import getCompiler from './helpers/getCompiler';
import GetLogsPlugin from './helpers/GetLogsPlugin';

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

  function listenShorthand(done) {
    return app.listen((error) => {
      if (error) {
        return done(error);
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
      let compiler;

      beforeAll((done) => {
        compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          publicPath: '/public/',
          mimeTypes: {
            typeMap: {
              'model/vnd.pixar.usd': ['usdz'],
            },
            force: true,
          },
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(compiler.outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(compiler.outputPath, '123a123412.hot-update.json'),
          '["hi"]'
        );
        // Add a nested directory and index.html inside
        // Add a nested directory and index.html inside
        instance.context.outputFileSystem.mkdirSync(
          path.resolve(compiler.outputPath, 'reference')
        );
        instance.context.outputFileSystem.mkdirSync(
          path.resolve(compiler.outputPath, 'reference/mono-v6.x.x')
        );
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(compiler.outputPath, 'reference/mono-v6.x.x/index.html'),
          'My Index.'
        );
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(compiler.outputPath, 'hello.wasm'),
          'welcome'
        );
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(compiler.outputPath, '3dAr.usdz'),
          '010101'
        );
      });

      afterAll((done) => {
        close(done);
      });

      it('should not find a bundle file on disk', (done) => {
        request(app)
          .get('/public/bundle.js')
          .expect(200, () => {
            const bundlePath = path.resolve(compiler.outputPath, 'bundle.js');

            expect(fs.existsSync(bundlePath)).toBe(false);
            done();
          });
      });

      it('GET request to bundle file', (done) => {
        const bundleData = instance.context.outputFileSystem.readFileSync(
          path.resolve(compiler.outputPath, 'bundle.js')
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
          .readFileSync(path.resolve(compiler.outputPath, 'bundle.js'))
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
          .readFileSync(path.resolve(compiler.outputPath, 'svg.svg'))
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
          path.resolve(compiler.outputPath, '123a123412.hot-update.json')
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
          path.resolve(compiler.outputPath, 'reference/mono-v6.x.x/index.html')
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
          path.resolve(compiler.outputPath, 'hello.wasm')
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
          path.resolve(compiler.outputPath, '3dAr.usdz')
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

        instance = middleware(compiler, { stats: 'errors-only' });

        instance(req, res, jest.fn()).then(done);
      });

      afterAll(close);
    });

    describe('should respect the "Content-Type" from other middleware', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, { stats: 'errors-only' });

        app = express();
        app.use((req, res, next) => {
          res.set('Content-Type', 'application/octet-stream');
          next();
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
        const compiler = getCompiler(webpackMultiConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          publicPath: '/',
        });

        app = express();
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
        const compiler = getCompiler(webpackClientServerConfig);

        instance = middleware(compiler, { stats: 'errors-only' });

        app = express();
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
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          index: 'Index.phtml',
          mimeTypes: {
            'text/html': ['phtml'],
          },
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(compiler.outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(compiler.outputPath, 'Index.phtml'),
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
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          index: 'Index.phtml',
          mimeTypes: {
            typeMap: { 'text/html': ['phtml'] },
            force: true,
          },
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(compiler.outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(compiler.outputPath, 'Index.phtml'),
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
      compiler = getCompiler(webpackConfig);

      spy = jest.spyOn(compiler, 'watch');

      instance = middleware(compiler, { stats: 'errors-only', watchOptions });

      app = express();
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
      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        writeToDisk: value,
      });

      app = express();
      app.use(instance);
      app.use((req, res) => {
        res.sendStatus(200);
      });

      listen = listenShorthand(done);

      return { compiler, instance, app };
    }

    function querystringToDisk(value, done) {
      const compiler = getCompiler(webpackQuerystringConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        writeToDisk: value,
      });

      app = express();
      app.use(instance);
      app.use((req, res) => {
        res.sendStatus(200);
      });

      listen = listenShorthand(done);

      return { compiler, instance, app };
    }

    function multiToDisk(value, done) {
      const compiler = getCompiler(webpackMultiConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        writeToDisk: value,
      });

      app = express();
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
      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        methods: ['POST'],
        publicPath: '/public/',
      });

      app = express();
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
      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        headers: { 'X-nonsense-1': 'yes', 'X-nonsense-2': 'no' },
      });

      app = express();
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

  describe('publicPath option', () => {
    describe('with "string" value', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          publicPath: '/public/',
        });

        app = express();
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
      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        stats: 'errors-only',
        serverSideRender: true,
      });

      app = express();
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
        compiler = getCompiler(webpackConfig);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should use "memfs" by default', () => {
        const { Stats } = memfs;

        expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
        expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
          Stats
        );
        expect(
          Object.prototype.hasOwnProperty.call(
            compiler.outputFileSystem,
            'join'
          )
        ).toBe(true);
        expect(
          Object.prototype.hasOwnProperty.call(
            compiler.outputFileSystem,
            'mkdirp'
          )
        ).toBe(true);
      });
    });

    describe('with configured value (native fs)', () => {
      let compiler;

      beforeAll((done) => {
        compiler = getCompiler(webpackConfig);

        const configuredFs = fs;

        configuredFs.join = path.join.bind(path);
        configuredFs.mkdirp = () => {};

        instance = middleware(compiler, {
          outputFileSystem: configuredFs,
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should use configurated output file system', () => {
        const { Stats } = fs;

        expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
        expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
          Stats
        );
        expect(
          Object.prototype.hasOwnProperty.call(
            compiler.outputFileSystem,
            'join'
          )
        ).toBe(true);
        expect(
          Object.prototype.hasOwnProperty.call(
            compiler.outputFileSystem,
            'mkdirp'
          )
        ).toBe(true);
      });
    });

    describe('with configured value (memfs)', () => {
      let compiler;

      beforeAll((done) => {
        compiler = getCompiler(webpackConfig);

        const configuredFs = createFsFromVolume(new Volume());

        configuredFs.join = path.join.bind(path);

        instance = middleware(compiler, {
          outputFileSystem: configuredFs,
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should use configurated output file system', () => {
        const { Stats } = memfs;

        expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
        expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
          Stats
        );
        expect(
          Object.prototype.hasOwnProperty.call(
            compiler.outputFileSystem,
            'join'
          )
        ).toBe(true);
        expect(
          Object.prototype.hasOwnProperty.call(
            compiler.outputFileSystem,
            'mkdirp'
          )
        ).toBe(true);
      });
    });

    describe('should throw error on invalid fs - no join method', () => {
      it('without "join" method', () => {
        expect(() => {
          const compiler = getCompiler(webpackConfig);

          middleware(compiler, { outputFileSystem: { mkdirp: () => {} } });
        }).toThrow(
          'Invalid options: options.outputFileSystem.join() method is expected'
        );
      });
    });

    describe('should throw error on invalid fs - no mkdirp method', () => {
      it('without "join" method', () => {
        expect(() => {
          const compiler = getCompiler(webpackConfig);

          middleware(compiler, { outputFileSystem: { join: () => {} } });
        }).toThrow(
          'Invalid options: options.outputFileSystem.mkdirp() method is expected'
        );
      });
    });
  });

  describe('index option', () => {
    describe('with "false" value', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          index: false,
          publicPath: '/',
        });

        app = express();
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
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          index: true,
          publicPath: '/',
        });

        app = express();
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
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          index: 'index.custom',
          mimeTypes: {
            'text/html': ['custom'],
          },
          publicPath: '/',
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(compiler.outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(compiler.outputPath, 'index.custom'),
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
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          index: 'noextension',
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(compiler.outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(compiler.outputPath, 'noextension'),
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
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          stats: 'errors-only',
          index: 'custom.html',
          publicPath: '/',
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(compiler.outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.mkdirSync(
          path.resolve(compiler.outputPath, 'custom.html')
        );
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
    describe('should log on successfully build', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler(webpackConfig);

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler, { stats: 'errors-warnings' });

        app = express();
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
              expect(getLogsPlugin.logs).toMatchSnapshot();

              done();
            });
          });
      });
    });

    describe('should log on unsuccessful build', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler(webpackErrorConfig);

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler, { stats: 'errors-warnings' });

        app = express();
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
              expect(getLogsPlugin.logs).toMatchSnapshot();

              done();
            });
          });
      });
    });

    describe('should log on warning build', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler(webpackWarningConfig);

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler, { stats: 'errors-warnings' });

        app = express();
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
              expect(getLogsPlugin.logs).toMatchSnapshot();

              done();
            });
          });
      });
    });

    describe('should log error in "watch" method', () => {
      let getLogsPlugin;

      it('on startup', () => {
        const compiler = getCompiler(webpackConfig);

        const watchSpy = jest
          .spyOn(compiler, 'watch')
          .mockImplementation((watchOptions, callback) => {
            const error = new Error('Error in Watch method');

            error.stack = '';

            callback(error);

            return { close: () => {} };
          });

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler, { stats: 'errors-only' });

        expect(getLogsPlugin.logs).toMatchSnapshot();

        instance.close();

        watchSpy.mockRestore();
      });
    });
  });
});
