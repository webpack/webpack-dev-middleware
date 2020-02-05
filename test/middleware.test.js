import fs from 'fs';
import path from 'path';

import express from 'express';
import request from 'supertest';
import memfs, { createFsFromVolume, Volume } from 'memfs';
import del from 'del';

import middleware from '../src';

import getCompiler from './helpers/getCompiler';
import GetLogsPlugin from './helpers/GetLogsPlugin';
import isWebpack5 from './helpers/isWebpack5';

import webpackConfig from './fixtures/webpack.config';
import webpackMultiConfig from './fixtures/webpack.array.config';
import webpackWatchOptionsConfig from './fixtures/webpack.watch-options.config';
import webpackMultiWatchOptionsConfig from './fixtures/webpack.array.watch-options.config';
import webpackQueryStringConfig from './fixtures/webpack.querystring.config';
import webpackClientServerConfig from './fixtures/webpack.client.server.config';
import webpackErrorConfig from './fixtures/webpack.error.config';
import webpackMultiErrorConfig from './fixtures/webpack.array.error.config';
import webpackWarningConfig from './fixtures/webpack.warning.config';
import webpackMultiWarningConfig from './fixtures/webpack.array.warning.config';
import webpackOneErrorOneWarningOneSuccessConfig from './fixtures/webpack.array.one-error-one-warning-one-success';
import webpackOneErrorOneWarningOneSuccessWithNamesConfig from './fixtures/webpack.array.one-error-one-warning-one-success-with-names';

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

        instance = middleware(compiler, { publicPath: '/public/' });

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
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(
            compiler.outputPath,
            'throw-an-exception-on-readFileSync.txt'
          ),
          'exception'
        );
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(compiler.outputPath, 'unknown'),
          'unknown'
        );
      });

      afterAll((done) => {
        close(done);
      });

      it('should not find a bundle file on disk', (done) => {
        request(app)
          .get('/public/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            expect(
              fs.existsSync(path.resolve(compiler.outputPath, 'bundle.js'))
            ).toBe(false);

            return done();
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
          .expect('Content-Type', 'application/javascript; charset=utf-8')
          .expect(200, bundleData.toString(), done);
      });

      it('HEAD request to bundle file', (done) => {
        const contentLength = instance.context.outputFileSystem
          .readFileSync(path.resolve(compiler.outputPath, 'bundle.js'))
          .byteLength.toString();

        request(app)
          .head('/public/bundle.js')
          .expect('Content-Length', contentLength)
          .expect('Content-Type', 'application/javascript; charset=utf-8')
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
          .expect('Content-Type', 'image/svg+xml')
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
          .expect('Content-Type', 'application/json; charset=utf-8')
          .expect(200, manifestData.toString(), done);
      });

      it('request to directory', (done) => {
        request(app)
          .get('/public/')
          .expect('Content-Type', 'text/html; charset=utf-8')
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
          .expect('Content-Type', 'text/html; charset=utf-8')
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
          .expect('Content-Type', 'model/vnd.usdz+zip')
          .expect('010101')
          .expect(200, fileData.toString(), done);
      });

      it('request to deleted file', (done) => {
        const spy = jest
          .spyOn(instance.context.outputFileSystem, 'readFileSync')
          .mockImplementation(() => {
            throw new Error('error');
          });

        request(app)
          .get('/public/throw-an-exception-on-readFileSync.txt')
          .expect(404, (error) => {
            if (error) {
              return done(error);
            }

            spy.mockRestore();

            return done();
          });
      });

      it('request to unknown file', (done) => {
        const fileData = instance.context.outputFileSystem.readFileSync(
          path.resolve(compiler.outputPath, 'unknown')
        );
        const contentLength = fileData.byteLength.toString();

        request(app)
          .get('/public/unknown')
          .expect('Content-Length', contentLength)
          .expect('Content-Type', 'application/octet-stream')
          .expect(200, done);
      });
    });

    describe('should respect the "Content-Type" from other middleware', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler);

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

    describe('should work in multi-compiler mode', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackMultiConfig);

        instance = middleware(compiler, { publicPath: '/' });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('request to both bundle files', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            return request(app)
              .get('/js2/bundle.js')
              .expect(200, done);
          });
      });
    });

    describe('should work with one "publicPath" in multi-compiler mode', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackClientServerConfig);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('request to bundle file', (done) => {
        request(app)
          .get('/static/bundle.js')
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

    describe('should respect the "stats" option with the "false" value from the configuration', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler({ ...webpackConfig, stats: false });

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(() => {
        close();
      });

      it('should handle request to bundle file', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            expect(getLogsPlugin.logs).toMatchSnapshot();

            return done();
          });
      });
    });

    describe('should respect the "stats" option with the "none" value from the configuration', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler({ ...webpackConfig, stats: 'none' });

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(() => {
        close();
      });

      it('should handle request to bundle file', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            expect(getLogsPlugin.logs).toMatchSnapshot();

            return done();
          });
      });
    });

    describe('should respect the "stats" option with the "minimal" value from the configuration', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler({ ...webpackConfig, stats: 'minimal' });

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(() => {
        close();
      });

      it('should handle request to bundle file', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            expect(getLogsPlugin.logs).toMatchSnapshot();

            return done();
          });
      });
    });

    describe('should respect the "stats" option with the "errors-warnings" value from the configuration', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler(webpackOneErrorOneWarningOneSuccessConfig);

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(() => {
        close();
      });

      it('should handle request to bundle file', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            expect(getLogsPlugin.logs).toMatchSnapshot();

            return done();
          });
      });
    });

    describe('should respect the "stats" option with the "{ all: false, entrypoints: true }" value from the configuration', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler({
          ...webpackConfig,
          stats: { all: false, entrypoints: true },
        });

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(() => {
        close();
      });

      it('should handle request to bundle file', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            expect(getLogsPlugin.logs).toMatchSnapshot();

            return done();
          });
      });
    });

    describe('should respect the "stats" option from the configuration in multi-compiler mode', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler(webpackMultiWarningConfig);

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(() => {
        close();
      });

      it('should handle request to bundle file', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            expect(getLogsPlugin.logs).toMatchSnapshot();

            return done();
          });
      });
    });

    describe('should respect the "stats" option from the configuration in multi-compiler mode and use the "name" option', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler(
          webpackOneErrorOneWarningOneSuccessWithNamesConfig
        );

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(() => {
        close();
      });

      it('should handle request to bundle file', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            expect(getLogsPlugin.logs).toMatchSnapshot();

            return done();
          });
      });
    });
  });

  describe('mimeTypes option', () => {
    describe('custom extensions', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          index: 'Index.phtml',
          mimeTypes: {
            phtml: 'text/html',
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
    describe('should work without value', () => {
      let compiler;
      let spy;

      beforeAll((done) => {
        compiler = getCompiler(webpackConfig);

        spy = jest.spyOn(compiler, 'watch');

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(() => {
        spy.mockRestore();

        close();
      });

      it('should pass to "watch" method', (done) => {
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toEqual({});

        request(app)
          .get('/bundle.js')
          .expect(200, done);
      });
    });

    describe('should respect option from config', () => {
      let compiler;
      let spy;

      beforeAll((done) => {
        compiler = getCompiler(webpackWatchOptionsConfig);

        spy = jest.spyOn(compiler, 'watch');

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(() => {
        spy.mockRestore();

        close();
      });

      it('should pass to "watch" method', (done) => {
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toEqual({
          aggregateTimeout: 300,
          poll: true,
        });

        request(app)
          .get('/bundle.js')
          .expect(200, done);
      });
    });

    describe('should respect option from config in multi-compile mode', () => {
      let compiler;
      let spy;

      beforeAll((done) => {
        compiler = getCompiler(webpackMultiWatchOptionsConfig);

        spy = jest.spyOn(compiler, 'watch');

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(() => {
        spy.mockRestore();

        close();
      });

      it('should pass to "watch" method', (done) => {
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toEqual([
          { aggregateTimeout: 800, poll: false },
          { aggregateTimeout: 300, poll: true },
        ]);

        request(app)
          .get('/js1/bundle.js')
          .expect(200, done);
      });
    });
  });

  describe('writeToDisk option', () => {
    function writeToDisk(value, done) {
      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, { writeToDisk: value });

      app = express();
      app.use(instance);

      listen = listenShorthand(done);

      return { compiler, instance, app };
    }

    function querystringToDisk(value, done) {
      const compiler = getCompiler(webpackQueryStringConfig);

      instance = middleware(compiler, { writeToDisk: value });

      app = express();
      app.use(instance);

      listen = listenShorthand(done);

      return { compiler, instance, app };
    }

    function multiToDisk(value, done) {
      const compiler = getCompiler(webpackMultiConfig);

      instance = middleware(compiler, { writeToDisk: value });

      app = express();
      app.use(instance);

      listen = listenShorthand(done);

      return { compiler, instance, app };
    }

    function writeToDiskWithHash(value, done) {
      const compiler = getCompiler({
        ...webpackConfig,
        ...{
          output: {
            filename: 'bundle.js',
            path: isWebpack5()
              ? path.resolve(__dirname, './outputs/dist_[fullhash]')
              : path.resolve(__dirname, './outputs/dist_[hash]'),
          },
        },
      });

      instance = middleware(compiler, { writeToDisk: value });

      app = express();
      app.use(instance);

      listen = listenShorthand(done);

      return { compiler, instance, app };
    }

    describe('should work with a "true" value', () => {
      let compiler;

      beforeAll((done) => {
        ({ compiler } = writeToDisk(true, done));
      });

      afterAll(close);

      it('should find the bundle file on disk', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = path.resolve(
              __dirname,
              './outputs/simple/bundle.js'
            );

            expect(
              compiler.hooks.assetEmitted.taps.filter(
                (hook) => hook.name === 'WebpackDevMiddleware'
              ).length
            ).toBe(1);
            expect(fs.existsSync(bundlePath)).toBe(true);

            fs.unlinkSync(bundlePath);

            instance.invalidate();

            return compiler.hooks.done.tap(
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

    describe('should work with a "false" value', () => {
      let compiler;

      beforeAll((done) => {
        ({ compiler } = writeToDisk(false, done));
      });

      afterAll(close);

      it('should not find the bundle file on disk', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = path.resolve(
              __dirname,
              './outputs/simple/bundle.js'
            );

            expect(
              compiler.hooks.assetEmitted.taps.filter(
                (hook) => hook.name === 'WebpackDevMiddleware'
              ).length
            ).toBe(0);
            expect(fs.existsSync(bundlePath)).toBe(false);

            instance.invalidate();

            return compiler.hooks.done.tap(
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

    describe('should work with the "Function" value, which returns "true"', () => {
      beforeAll((done) => {
        writeToDisk((filePath) => /bundle\.js$/.test(filePath), done);
      });

      afterAll(close);

      it('should find the bundle file on disk', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = path.resolve(
              __dirname,
              './outputs/simple/bundle.js'
            );

            expect(fs.existsSync(bundlePath)).toBe(true);

            fs.unlinkSync(bundlePath);

            return done();
          });
      });
    });

    describe('should work with the "Function" value, which returns "false"', () => {
      beforeAll((done) => {
        writeToDisk((filePath) => !/bundle\.js$/.test(filePath), done);
      });

      afterAll(close);

      it('should not find the bundle file on disk', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = path.resolve(
              __dirname,
              './outputs/simple/bundle.js'
            );

            expect(fs.existsSync(bundlePath)).toBe(false);

            return done();
          });
      });
    });

    describe('should work when assets have query string', () => {
      beforeAll((done) => {
        querystringToDisk(true, done);
      });

      afterAll(close);

      it('should find the bundle file on disk with no querystring', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = path.resolve(
              __dirname,
              './outputs/querystring/bundle.js'
            );

            expect(fs.existsSync(bundlePath)).toBe(true);

            fs.unlinkSync(bundlePath);

            return done();
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
          .get('/js1/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundleFiles = [
              './outputs/array/js1/bundle.js',
              './outputs/array/js1/index.html',
              './outputs/array/js1/svg.svg',
              './outputs/array/js2/bundle.js',
            ];

            for (const bundleFile of bundleFiles) {
              const bundlePath = path.resolve(__dirname, bundleFile);

              expect(fs.existsSync(bundlePath)).toBe(true);

              fs.unlinkSync(bundlePath);
            }

            fs.rmdirSync(path.resolve(__dirname, './outputs/array/js1/'));
            fs.rmdirSync(path.resolve(__dirname, './outputs/array/js2/'));

            return done();
          });
      });
    });

    describe.skip('should work with "[hash]"/"[fullhash]" in the "output.path" option', () => {
      beforeAll((done) => {
        writeToDiskWithHash(true, done);
      });

      afterAll(close);

      it('should find the bundle file on disk', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = isWebpack5()
              ? path.resolve(
                  __dirname,
                  './outputs/dist_6e9d1c41483198efea74/bundle.js'
                )
              : path.resolve(
                  __dirname,
                  './outputs/dist_f2e154f7f2fe769e53d3/bundle.js'
                );

            expect(fs.existsSync(bundlePath)).toBe(true);

            del.sync(path.dirname(bundlePath));

            return done();
          });
      });
    });
  });

  describe('methods option', () => {
    beforeAll((done) => {
      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
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
        .expect('Content-Type', 'application/javascript; charset=utf-8')
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

        instance = middleware(compiler, { publicPath: '/public/' });

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
          .expect('Content-Type', 'application/javascript; charset=utf-8')
          .expect(200, /console\.log\('Hey\.'\)/, done);
      });
    });
  });

  describe('serverSideRender option', () => {
    let locals;

    beforeAll((done) => {
      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, { serverSideRender: true });

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
        .expect(200, (error) => {
          if (error) {
            return done(error);
          }

          expect(locals.webpack.stats).toBeDefined();
          expect(locals.webpack.outputFileSystem).toBeDefined();

          return done();
        });
    });
  });

  describe('outputFileSystem option', () => {
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

    describe('with configured value in multi compiler mode (native fs)', () => {
      let compiler;

      beforeAll((done) => {
        compiler = getCompiler(webpackMultiConfig);

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

        for (const compilerFromMultiCompilerMode of compiler.compilers) {
          expect(
            new compilerFromMultiCompilerMode.outputFileSystem.Stats()
          ).toBeInstanceOf(Stats);

          expect(
            Object.prototype.hasOwnProperty.call(
              compilerFromMultiCompilerMode.outputFileSystem,
              'join'
            )
          ).toBe(true);
          expect(
            Object.prototype.hasOwnProperty.call(
              compilerFromMultiCompilerMode.outputFileSystem,
              'mkdirp'
            )
          ).toBe(true);
        }

        expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
          Stats
        );
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

        instance = middleware(compiler, { index: false, publicPath: '/' });

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

        instance = middleware(compiler, { index: true, publicPath: '/' });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('request to directory', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200, done);
      });
    });

    describe('with "string" value', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          index: 'default.html',
          publicPath: '/',
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(compiler.outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(compiler.outputPath, 'default.html'),
          'hello'
        );
      });

      afterAll(close);

      it('request to directory', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200, done);
      });
    });

    describe('with "string" value with custom extension', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          index: 'index.custom',
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
          .expect('Content-Type', 'application/octet-stream')
          .expect(200, done);
      });
    });

    describe('with "string" value with custom extension and defined custom MIME type', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          index: 'index.custom',
          mimeTypes: {
            custom: 'text/html',
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
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200, done);
      });
    });

    describe('with "string" value without extension', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, { index: 'noextension' });

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
          // The "Content-Type" header should have "token" and "subtype"
          // https://tools.ietf.org/html/rfc7231#section-3.1.1.1
          .expect('Content-Type', 'application/octet-stream')
          .expect(200, done);
      });
    });

    describe('with "string" value but index is directory', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
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

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('logs', (done) => {
        request(app)
          .get('/bundle.js')
          .expect('Content-Type', 'application/javascript; charset=utf-8')
          .expect(200, /console\.log\('Hey\.'\)/, (error) => {
            if (error) {
              return done(error);
            }

            instance.invalidate();

            return instance.waitUntilValid(() => {
              expect(getLogsPlugin.logs).toMatchSnapshot();

              done();
            });
          });
      });
    });

    describe('should log on successfully build in multi-compiler mode', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler(webpackMultiConfig);

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('logs', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect('Content-Type', 'application/javascript; charset=utf-8')
          .expect(200, /console\.log\('Hey\.'\)/, (error) => {
            if (error) {
              return done(error);
            }

            instance.invalidate();

            return instance.waitUntilValid(() => {
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

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('logs', (done) => {
        request(app)
          .get('/bundle.js')
          .expect('Content-Type', 'application/javascript; charset=utf-8')
          .expect(200, /1\(\)2\(\)3\(\)/, (error) => {
            if (error) {
              return done(error);
            }

            instance.invalidate();

            return instance.waitUntilValid(() => {
              expect(getLogsPlugin.logs).toMatchSnapshot();

              done();
            });
          });
      });
    });

    describe('should log on unsuccessful build in multi-compiler ', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler(webpackMultiErrorConfig);

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('logs', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect('Content-Type', 'application/javascript; charset=utf-8')
          .expect(200, /1\(\)2\(\)3\(\)/, (error) => {
            if (error) {
              return done(error);
            }

            instance.invalidate();

            return instance.waitUntilValid(() => {
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

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('logs', (done) => {
        request(app)
          .get('/bundle.js')
          .expect('Content-Type', 'application/javascript; charset=utf-8')
          .expect(200, /console\.log\('foo'\)/, (error) => {
            if (error) {
              return done(error);
            }

            instance.invalidate();

            return instance.waitUntilValid(() => {
              expect(getLogsPlugin.logs).toMatchSnapshot();

              done();
            });
          });
      });
    });

    describe('should log on warning build in multi-compiler mode', () => {
      let compiler;
      let getLogsPlugin;

      beforeAll((done) => {
        compiler = getCompiler(webpackMultiWarningConfig);

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('logs', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect('Content-Type', 'application/javascript; charset=utf-8')
          .expect(200, /console\.log\('foo'\)/, (error) => {
            if (error) {
              return done(error);
            }

            instance.invalidate();

            return instance.waitUntilValid(() => {
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

        instance = middleware(compiler);

        expect(getLogsPlugin.logs).toMatchSnapshot();

        instance.close();

        watchSpy.mockRestore();
      });
    });
  });
});
