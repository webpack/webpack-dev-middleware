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
import webpackSimpleConfig from './fixtures/webpack.simple.config';
import webpackMultiConfig from './fixtures/webpack.array.config';
import webpackWatchOptionsConfig from './fixtures/webpack.watch-options.config';
import webpackMultiWatchOptionsConfig from './fixtures/webpack.array.watch-options.config';
import webpackQueryStringConfig from './fixtures/webpack.querystring.config';
import webpackErrorConfig from './fixtures/webpack.error.config';
import webpackMultiErrorConfig from './fixtures/webpack.array.error.config';
import webpackWarningConfig from './fixtures/webpack.warning.config';
import webpackMultiWarningConfig from './fixtures/webpack.array.warning.config';

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
    if (instance.context.watching.closed) {
      if (listen) {
        listen.close(done);
      } else {
        done();
      }

      return;
    }

    instance.close(() => {
      if (listen) {
        listen.close(done);
      } else {
        done();
      }
    });
  }

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

      afterAll((done) => {
        spy.mockRestore();

        close(done);
      });

      it('should pass arguments to the "watch" method', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][0]).toEqual({});

            return done();
          });
      });
    });

    describe('should respect options from the configuration', () => {
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

      afterAll((done) => {
        spy.mockRestore();

        close(done);
      });

      it('should pass arguments to the "watch" method', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(done);
            }

            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][0]).toEqual({
              aggregateTimeout: 300,
              poll: true,
            });

            return done(error);
          });
      });
    });

    describe('should respect options from the configuration in multi-compile mode', () => {
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

      afterAll((done) => {
        spy.mockRestore();

        close(done);
      });

      it('should pass arguments to the "watch" method', (done) => {
        request(app)
          .get('/static-one/bundle.js')
          .expect(200, (firstError) => {
            if (firstError) {
              return done(firstError);
            }

            return request(app)
              .get('/static-two/bundle.js')
              .expect(200, (secondError) => {
                if (secondError) {
                  return done(secondError);
                }

                expect(spy).toHaveBeenCalledTimes(1);
                expect(spy.mock.calls[0][0]).toEqual([
                  { aggregateTimeout: 800, poll: false },
                  { aggregateTimeout: 300, poll: true },
                ]);

                return done();
              });
          });
      });
    });
  });

  describe('writeToDisk option', () => {
    describe('should work with "true" value', () => {
      let compiler;

      beforeAll((done) => {
        compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: path.resolve(__dirname, './outputs/write-to-disk-true'),
          },
        });

        instance = middleware(compiler, { writeToDisk: true });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll((done) => {
        del.sync(path.posix.resolve(__dirname, './outputs/write-to-disk-true'));

        close(done);
      });

      it('should find the bundle file on disk', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = path.resolve(
              __dirname,
              './outputs/write-to-disk-true/bundle.js'
            );

            expect(
              compiler.hooks.assetEmitted.taps.filter(
                (hook) => hook.name === 'DevMiddleware'
              ).length
            ).toBe(1);
            expect(fs.existsSync(bundlePath)).toBe(true);

            instance.invalidate();

            return compiler.hooks.done.tap(
              'DevMiddlewareWriteToDiskTest',
              () => {
                expect(
                  compiler.hooks.assetEmitted.taps.filter(
                    (hook) => hook.name === 'DevMiddleware'
                  ).length
                ).toBe(1);

                done();
              }
            );
          });
      });
    });

    describe('should work with "false" value', () => {
      let compiler;

      beforeAll((done) => {
        compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: path.resolve(__dirname, './outputs/write-to-disk-false'),
          },
        });

        instance = middleware(compiler, { writeToDisk: false });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
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
              './outputs/write-to-disk-false/bundle.js'
            );

            expect(
              compiler.hooks.assetEmitted.taps.filter(
                (hook) => hook.name === 'DevMiddleware'
              ).length
            ).toBe(0);
            expect(fs.existsSync(bundlePath)).toBe(false);

            instance.invalidate();

            return compiler.hooks.done.tap(
              'DevMiddlewareWriteToDiskTest',
              () => {
                expect(
                  compiler.hooks.assetEmitted.taps.filter(
                    (hook) => hook.name === 'DevMiddleware'
                  ).length
                ).toBe(0);

                done();
              }
            );
          });
      });
    });

    describe('should work with "Function" value when it returns "true"', () => {
      let compiler;

      beforeAll((done) => {
        compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: path.resolve(
              __dirname,
              './outputs/write-to-disk-function-true'
            ),
          },
        });

        instance = middleware(compiler, {
          writeToDisk: (filePath) => /bundle\.js$/.test(filePath),
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll((done) => {
        del.sync(
          path.posix.resolve(__dirname, './outputs/write-to-disk-function-true')
        );

        close(done);
      });

      it('should find the bundle file on disk', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = path.resolve(
              __dirname,
              './outputs/write-to-disk-function-true/bundle.js'
            );

            expect(fs.existsSync(bundlePath)).toBe(true);

            return done();
          });
      });
    });

    describe('should work with "Function" value when it returns "false"', () => {
      let compiler;

      beforeAll((done) => {
        compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: path.resolve(
              __dirname,
              './outputs/write-to-disk-function-false'
            ),
          },
        });

        instance = middleware(compiler, {
          writeToDisk: (filePath) => !/bundle\.js$/.test(filePath),
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll((done) => {
        del.sync(
          path.posix.resolve(
            __dirname,
            './outputs/write-to-disk-function-false'
          )
        );

        close(done);
      });

      it('should not find the bundle file on disk', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = path.resolve(
              __dirname,
              './outputs/write-to-disk-function-false/bundle.js'
            );

            expect(fs.existsSync(bundlePath)).toBe(false);

            return done();
          });
      });
    });

    describe('should work when assets have query string', () => {
      let compiler;

      beforeAll((done) => {
        compiler = getCompiler({
          ...webpackQueryStringConfig,
          output: {
            filename: 'bundle.js?[contenthash]',
            path: path.resolve(
              __dirname,
              './outputs/write-to-disk-query-string'
            ),
          },
        });

        instance = middleware(compiler, { writeToDisk: true });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll((done) => {
        del.sync(
          path.posix.resolve(__dirname, './outputs/write-to-disk-query-string')
        );

        close(done);
      });

      it('should find the bundle file on disk with no querystring', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = path.resolve(
              __dirname,
              './outputs/write-to-disk-query-string/bundle.js'
            );

            expect(fs.existsSync(bundlePath)).toBe(true);

            return done();
          });
      });
    });

    describe('should work in multi-compiler mode', () => {
      let compiler;

      beforeAll((done) => {
        compiler = getCompiler([
          {
            ...webpackMultiWatchOptionsConfig[0],
            output: {
              filename: 'bundle.js',
              path: path.resolve(
                __dirname,
                './outputs/write-to-disk-multi-compiler/static-one'
              ),
              publicPath: '/static-one/',
            },
          },
          {
            ...webpackMultiWatchOptionsConfig[1],
            output: {
              filename: 'bundle.js',
              path: path.resolve(
                __dirname,
                './outputs/write-to-disk-multi-compiler/static-two'
              ),
              publicPath: '/static-two/',
            },
          },
        ]);

        instance = middleware(compiler, { writeToDisk: true });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll((done) => {
        del.sync(
          path.posix.resolve(
            __dirname,
            './outputs/write-to-disk-multi-compiler/'
          )
        );

        close(done);
      });

      it('should find the bundle files on disk', (done) => {
        request(app)
          .get('/static-one/bundle.js')
          .expect(200, (firstError) => {
            if (firstError) {
              return done(firstError);
            }

            return request(app)
              .get('/static-two/bundle.js')
              .expect(200, (secondError) => {
                if (secondError) {
                  return done(secondError);
                }
                const bundleFiles = [
                  './outputs/write-to-disk-multi-compiler/static-one/bundle.js',
                  './outputs/write-to-disk-multi-compiler/static-one/index.html',
                  './outputs/write-to-disk-multi-compiler/static-one/svg.svg',
                  './outputs/write-to-disk-multi-compiler/static-two/bundle.js',
                ];

                for (const bundleFile of bundleFiles) {
                  const bundlePath = path.resolve(__dirname, bundleFile);

                  expect(fs.existsSync(bundlePath)).toBe(true);
                }

                return done();
              });
          });
      });
    });

    describe('should work with "[hash]"/"[fullhash]" in the "output.path" and "output.publicPath" option', () => {
      let compiler;
      let hash;

      beforeAll((done) => {
        compiler = getCompiler({
          ...webpackConfig,
          ...{
            output: {
              filename: 'bundle.js',
              publicPath: isWebpack5()
                ? '/static/[fullhash]/'
                : '/static/[hash]/',
              path: isWebpack5()
                ? path.resolve(
                    __dirname,
                    './outputs/write-to-disk-with-hash/dist_[fullhash]'
                  )
                : path.resolve(
                    __dirname,
                    './outputs/write-to-disk-with-hash/dist_[hash]'
                  ),
            },
          },
        });

        instance = middleware(compiler, { writeToDisk: true });

        app = express();
        app.use(instance);

        listen = listenShorthand(() => {
          compiler.hooks.afterCompile.tap('wdm-test', ({ hash: h }) => {
            hash = h;
            done();
          });
        });
      });

      afterAll((done) => {
        del.sync(
          path.posix.resolve(__dirname, './outputs/write-to-disk-with-hash/')
        );

        close(done);
      });

      it('should find the bundle file on disk', (done) => {
        request(app)
          .get(`/static/${hash}/bundle.js`)
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = path.resolve(
              __dirname,
              `./outputs/write-to-disk-with-hash/dist_${hash}/bundle.js`
            );

            expect(fs.existsSync(bundlePath)).toBe(true);

            return done();
          });
      });
    });
  });

  describe('methods option', () => {
    let compiler;

    beforeAll((done) => {
      compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        methods: ['POST'],
        publicPath: '/public/',
      });

      app = express();
      app.use(instance);

      listen = listenShorthand(done);
    });

    afterAll(close);

    it('should return the "200" code for the "POST" request to the bundle file', (done) => {
      request(app).post('/public/bundle.js').expect(200, done);
    });

    it('should return the "404" code for the "GET" request to the bundle file', (done) => {
      request(app).get('/public/bundle.js').expect(404, done);
    });

    it('should return the "200" code for the "HEAD" request to the bundle file', (done) => {
      request(app).head('/public/bundle.js').expect(404, done);
    });
  });

  describe('headers option', () => {
    beforeEach((done) => {
      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        headers: { 'X-nonsense-1': 'yes', 'X-nonsense-2': 'no' },
      });

      app = express();
      app.use(instance);

      listen = listenShorthand(done);
    });

    afterEach(close);

    it('should return the "200" code for the "GET" request to the bundle file and return headers', (done) => {
      request(app)
        .get('/bundle.js')
        .expect('X-nonsense-1', 'yes')
        .expect('X-nonsense-2', 'no')
        .expect(200, done);
    });

    it('should return the "200" code for the "GET" request to path not in outputFileSystem but not return headers', async () => {
      app.get('/file.jpg', (req, res) => {
        res.send('welcome');
      });

      const res = await request(app).get('/file.jpg');
      expect(res.statusCode).toEqual(200);
      expect(res.headers['X-nonsense-1']).toBeUndefined();
      expect(res.headers['X-nonsense-2']).toBeUndefined();
    });
  });

  describe('publicPath option', () => {
    describe('should work with "string" value', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, { publicPath: '/public/' });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to the bundle file', (done) => {
        request(app).get('/public/bundle.js').expect(200, done);
      });
    });

    describe('should work with "auto" value', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, { publicPath: 'auto' });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to the bundle file', (done) => {
        request(app).get('/bundle.js').expect(200, done);
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

    it('should return the "200" code for the "GET" request', (done) => {
      request(app)
        .get('/foo/bar')
        .expect(200, (error) => {
          if (error) {
            return done(error);
          }

          expect(locals.webpack.devMiddleware).toBeDefined();

          return done();
        });
    });
  });

  describe('outputFileSystem option', () => {
    describe('should work with an unspecified value', () => {
      let compiler;

      beforeAll((done) => {
        compiler = getCompiler(webpackConfig);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should use the "memfs" package by default', () => {
        const { Stats } = memfs;

        expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
        expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
          Stats
        );
        expect(compiler.outputFileSystem).toHaveProperty('join');
        expect(compiler.outputFileSystem).toHaveProperty('mkdirp');
      });
    });

    describe('should work with the configured value (native fs)', () => {
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

      it('should use the configurated output filesystem', () => {
        const { Stats } = fs;

        expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
        expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
          Stats
        );
        expect(compiler.outputFileSystem).toHaveProperty('join');
        expect(compiler.outputFileSystem).toHaveProperty('mkdirp');
      });
    });

    describe('should work with the configured value (memfs)', () => {
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

      it('should use the configured output filesystem', () => {
        const { Stats } = memfs;

        expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
        expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
          Stats
        );
        expect(compiler.outputFileSystem).toHaveProperty('join');
        expect(compiler.outputFileSystem).toHaveProperty('mkdirp');
      });
    });

    describe('should work with the configured value in multi-compiler mode (native fs)', () => {
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

      it('should use configured output filesystems', () => {
        const { Stats } = fs;

        for (const childCompiler of compiler.compilers) {
          expect(new childCompiler.outputFileSystem.Stats()).toBeInstanceOf(
            Stats
          );
          expect(childCompiler.outputFileSystem).toHaveProperty('join');
          expect(childCompiler.outputFileSystem).toHaveProperty('mkdirp');
        }

        expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
          Stats
        );
        expect(instance.context.outputFileSystem).toHaveProperty('join');
        expect(instance.context.outputFileSystem).toHaveProperty('mkdirp');
      });
    });

    describe('should throw an error on the invalid fs value - no join method', () => {
      it('should throw an error', () => {
        expect(() => {
          const compiler = getCompiler(webpackConfig);

          middleware(compiler, { outputFileSystem: { mkdirp: () => {} } });
        }).toThrow(
          'Invalid options: options.outputFileSystem.join() method is expected'
        );
      });
    });

    describe('should throw an error on the invalid fs value - no mkdirp method', () => {
      it('should throw an error', () => {
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
    describe('should work with "false" value', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, { index: false, publicPath: '/' });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return the "404" code for the "GET" request to the public path', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(404, done);
      });

      it('should return the "200" code for the "GET" request to the "index.html" file', (done) => {
        request(app)
          .get('/index.html')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200, done);
      });
    });

    describe('should work with "true" value', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, { index: true, publicPath: '/' });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to the public path', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200, done);
      });

      it('should return the "200" code for the "GET" request to the public path', (done) => {
        request(app)
          .get('/index.html')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200, done);
      });
    });

    describe('should work with "string" value', () => {
      beforeAll((done) => {
        const outputPath = path.resolve(__dirname, './outputs/basic');
        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: outputPath,
          },
        });

        instance = middleware(compiler, {
          index: 'default.html',
          publicPath: '/',
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, 'default.html'),
          'hello'
        );
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to the public path', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200, done);
      });
    });

    describe('should work with "string" value with a custom extension', () => {
      beforeAll((done) => {
        const outputPath = path.resolve(__dirname, './outputs/basic');
        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: outputPath,
          },
        });

        instance = middleware(compiler, {
          index: 'index.custom',
          publicPath: '/',
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, 'index.custom'),
          'hello'
        );
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to the public path', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'application/octet-stream')
          .expect(200, done);
      });
    });

    describe('should work with "string" value with a custom extension and defined a custom MIME type', () => {
      beforeAll((done) => {
        const outputPath = path.resolve(__dirname, './outputs/basic');
        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: outputPath,
          },
        });

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

        instance.context.outputFileSystem.mkdirSync(outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, 'index.custom'),
          'hello'
        );
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to the public path', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200, done);
      });
    });

    describe('should work with "string" value without an extension', () => {
      beforeAll((done) => {
        const outputPath = path.resolve(__dirname, './outputs/basic');
        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: outputPath,
          },
        });

        instance = middleware(compiler, { index: 'noextension' });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, 'noextension'),
          'hello'
        );
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to the public path', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'application/octet-stream')
          .expect(200, done);
      });
    });

    describe('should work with "string" value but the "index" option is a directory', () => {
      beforeAll((done) => {
        const outputPath = path.resolve(__dirname, './outputs/basic');
        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: outputPath,
          },
        });

        instance = middleware(compiler, {
          index: 'custom.html',
          publicPath: '/',
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.mkdirSync(
          path.resolve(outputPath, 'custom.html')
        );
      });

      afterAll(close);

      it('should return the "404" code for the "GET" request to the public path', (done) => {
        request(app).get('/').expect(404, done);
      });
    });

    describe('should not handle request when index is neither a file nor a directory', () => {
      let compiler;
      let isDirectory;

      beforeAll((done) => {
        compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, {
          index: 'default.html',
          publicPath: '/',
        });

        isDirectory = jest
          .spyOn(instance.context.outputFileSystem, 'statSync')
          .mockImplementation(() => {
            return {
              isFile: () => false,
              isDirectory: () => false,
            };
          });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll((done) => {
        isDirectory.mockRestore();

        close(done);
      });

      it('should return the "404" code for the "GET" request to the public path', (done) => {
        request(app).get('/').expect(404, done);
      });
    });
  });

  describe('logger', () => {
    describe('should logging on successfully build', () => {
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

      it('should logging', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
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

    describe('should logging on successfully build in multi-compiler mode', () => {
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

      it('should logging', (done) => {
        request(app)
          .get('/static-one/bundle.js')
          .expect(200, (error) => {
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

    describe('should logging on unsuccessful build', () => {
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

      it('should logging', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
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

    describe('should logging on unsuccessful build in multi-compiler ', () => {
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

      it('should logging', (done) => {
        request(app)
          .get('/static-one/bundle.js')
          .expect(200, (error) => {
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

    describe('should logging an warning', () => {
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

      it('should logging', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
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

    describe('should logging warnings in multi-compiler mode', () => {
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

      it('should logging', (done) => {
        request(app)
          .get('/static-one/bundle.js')
          .expect(200, (error) => {
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

    describe('should logging an error in "watch" method', () => {
      let getLogsPlugin;

      it('should logging on startup', () => {
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

    describe('should logging an error from the "fs.mkdir" method when the "writeToDisk" option is "true" ', () => {
      let compiler;
      let getLogsPlugin;
      let mkdirSpy;

      beforeAll((done) => {
        compiler = getCompiler({
          ...webpackSimpleConfig,
          output: {
            filename: 'bundle.js',
            path: path.resolve(
              __dirname,
              './outputs/write-to-disk-mkdir-error'
            ),
          },
        });

        mkdirSpy = jest.spyOn(fs, 'mkdir').mockImplementation((...args) => {
          const callback = args[args.length - 1];

          return callback(new Error('Error in the "fs.mkdir" method.'));
        });

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler, { writeToDisk: true });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll((done) => {
        del.sync(
          path.posix.resolve(__dirname, './outputs/write-to-disk-mkdir-error')
        );

        mkdirSpy.mockRestore();

        close(done);
      });

      it('should logging', (done) => {
        compiler.hooks.failed.tap('FailedCatcher', () => {
          instance.close(() => {
            expect(getLogsPlugin.logs).toMatchSnapshot();

            done();
          });
        });
      });
    });

    describe('should logging an error from the "fs.writeFile" method when the "writeToDisk" option is "true" ', () => {
      let compiler;
      let getLogsPlugin;
      let writeFileSpy;

      beforeAll((done) => {
        compiler = getCompiler({
          ...webpackSimpleConfig,
          output: {
            filename: 'bundle.js',
            path: path.resolve(
              __dirname,
              './outputs/write-to-disk-writeFile-error'
            ),
          },
        });

        writeFileSpy = jest
          .spyOn(fs, 'writeFile')
          .mockImplementation((...args) => {
            const callback = args[args.length - 1];

            return callback(new Error('Error in the "fs.writeFile" method.'));
          });

        getLogsPlugin = new GetLogsPlugin();
        getLogsPlugin.apply(compiler);

        instance = middleware(compiler, { writeToDisk: true });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll((done) => {
        writeFileSpy.mockRestore();

        del.sync(
          path.posix.resolve(
            __dirname,
            './outputs/write-to-disk-writeFile-error'
          )
        );

        close(done);
      });

      it('should logging', (done) => {
        compiler.hooks.failed.tap('FailedCatcher', () => {
          instance.close(() => {
            expect(getLogsPlugin.logs).toMatchSnapshot();

            done();
          });
        });
      });
    });
  });
});
