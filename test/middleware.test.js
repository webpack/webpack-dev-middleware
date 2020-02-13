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
      const outputPath = path.resolve(__dirname, './outputs/basic');

      beforeAll((done) => {
        compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: outputPath,
          },
        });

        instance = middleware(compiler, { publicPath: '/public/' });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, '123a123412.hot-update.json'),
          '["hi"]'
        );
        // Add a nested directory and index.html inside
        // Add a nested directory and index.html inside
        instance.context.outputFileSystem.mkdirSync(
          path.resolve(outputPath, 'reference')
        );
        instance.context.outputFileSystem.mkdirSync(
          path.resolve(outputPath, 'reference/mono-v6.x.x')
        );
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, 'reference/mono-v6.x.x/index.html'),
          'My Index.'
        );
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, 'hello.wasm'),
          'welcome'
        );
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, '3dAr.usdz'),
          '010101'
        );
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, 'throw-an-exception-on-readFileSync.txt'),
          'exception'
        );
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, 'unknown'),
          'unknown'
        );
      });

      afterAll(close);

      it('should not find a bundle file on disk', (done) => {
        request(app)
          .get('/public/bundle.js')
          .expect('Content-Type', 'application/javascript; charset=utf-8')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            expect(fs.existsSync(path.resolve(outputPath, 'bundle.js'))).toBe(
              false
            );

            return done();
          });
      });

      it('should return the "200" code for the "GET" request to the bundle file', (done) => {
        const fileData = instance.context.outputFileSystem.readFileSync(
          path.resolve(outputPath, 'bundle.js')
        );

        request(app)
          .get('/public/bundle.js')
          .expect('Content-Length', fileData.byteLength.toString())
          .expect('Content-Type', 'application/javascript; charset=utf-8')
          .expect(200, fileData.toString(), done);
      });

      it('should return the "200" code for the "HEAD" request to the bundle file', (done) => {
        request(app)
          .head('/public/bundle.js')
          .expect(
            'Content-Length',
            instance.context.outputFileSystem
              .readFileSync(path.resolve(outputPath, 'bundle.js'))
              .byteLength.toString()
          )
          .expect('Content-Type', 'application/javascript; charset=utf-8')
          // eslint-disable-next-line no-undefined
          .expect(200, undefined, done);
      });

      it('should return the "404" code for the "POST" request to the bundle file', (done) => {
        request(app)
          .post('/public/bundle.js')
          .expect(404, done);
      });

      it('should return the "200" code for the "GET" request to the image file', (done) => {
        const fileData = instance.context.outputFileSystem.readFileSync(
          path.resolve(outputPath, 'svg.svg')
        );

        request(app)
          .get('/public/svg.svg')
          .expect('Content-Length', fileData.byteLength.toString())
          .expect('Content-Type', 'image/svg+xml')
          .expect(200, fileData, done);
      });

      it('should return the "404" code for the "GET" request to a nonexisting file', (done) => {
        request(app)
          .get('/public/nope')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(404, done);
      });

      it('should return the "200" code for the "GET" request to the hot module replacement file', (done) => {
        const fileData = instance.context.outputFileSystem.readFileSync(
          path.resolve(outputPath, '123a123412.hot-update.json')
        );

        request(app)
          .get('/public/123a123412.hot-update.json')
          .expect('Content-Length', fileData.byteLength.toString())
          .expect('Content-Type', 'application/json; charset=utf-8')
          .expect(200, fileData.toString(), done);
      });

      it('should return the "200" code for the "GET" request to the directory', (done) => {
        const fileData = fs.readFileSync(
          path.resolve(__dirname, './fixtures/index.html')
        );

        request(app)
          .get('/public/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect('Content-Length', fileData.byteLength.toString())
          .expect(200, fileData.toString(), done);
      });

      it('should return the "200" code for the "GET" request to the subdirectory without trailing slash', (done) => {
        const fileData = instance.context.outputFileSystem.readFileSync(
          path.resolve(outputPath, 'reference/mono-v6.x.x/index.html')
        );

        request(app)
          .get('/public/reference/mono-v6.x.x')
          .expect('Content-Length', fileData.byteLength.toString())
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200, fileData.toString(), done);
      });

      it('should return the "416" code for the "GET" request with the invalid range header', (done) => {
        request(app)
          .get('/public/svg.svg')
          .set('Range', 'bytes=6000-')
          .expect(416, done);
      });

      it('should return the "206" code for the "GET" request with the valid range header', (done) => {
        request(app)
          .get('/public/svg.svg')
          .set('Range', 'bytes=3000-3500')
          .expect('Content-Length', '501')
          .expect('Content-Range', 'bytes 3000-3500/4778')
          .expect(206, done);
      });

      it('should return the "404" code for the "GET" request with to the non-public path', (done) => {
        request(app)
          .get('/nonpublic/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(404, done);
      });

      it('should return the "200" code for the "GET" request to "hello.wasm"', (done) => {
        const fileData = instance.context.outputFileSystem.readFileSync(
          path.resolve(outputPath, 'hello.wasm')
        );

        request(app)
          .get('/public/hello.wasm')
          .expect('Content-Length', fileData.byteLength.toString())
          .expect('Content-Type', 'application/wasm')
          .expect(200, fileData.toString(), done);
      });

      it('should return the "200" code for the "GET" request to "3dAr.usdz"', (done) => {
        const fileData = instance.context.outputFileSystem.readFileSync(
          path.resolve(outputPath, '3dAr.usdz')
        );

        request(app)
          .get('/public/3dAr.usdz')
          .expect('Content-Length', fileData.byteLength.toString())
          .expect('Content-Type', 'model/vnd.usdz+zip')
          .expect('010101')
          .expect(200, fileData.toString(), done);
      });

      it('should return the "404" code for the "GET" request to the deleted file', (done) => {
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

      it('should return "200" code code for the "GET" request to the file without extension', (done) => {
        const fileData = instance.context.outputFileSystem.readFileSync(
          path.resolve(outputPath, 'unknown')
        );

        request(app)
          .get('/public/unknown')
          .expect('Content-Length', fileData.byteLength.toString())
          .expect('Content-Type', 'application/octet-stream')
          .expect(200, done);
      });
    });

    describe('should respect the value of the "Content-Type" header from other middleware', () => {
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

      it('should not guess a MIME type if the "Content-Type" header is found', (done) => {
        request(app)
          .get('/bundle.js')
          .expect('Content-Type', 'application/octet-stream')
          .expect(200, done);
      });
    });

    describe('should not throw an error on the valid "output.path" value for linux', () => {
      it('should be no error', (done) => {
        expect(() => {
          const compiler = getCompiler();

          compiler.outputPath = '/my/path';

          instance = middleware(compiler);

          instance.close(done);
        }).not.toThrow();
      });
    });

    describe('should not throw an error on the valid "output.path" value for windows', () => {
      it('should be no error', (done) => {
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

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return 200 code for GET request to the first bundle file', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect(200, done);
      });

      it('should return 200 code for GET request to the second bundle file', (done) => {
        request(app)
          .get('/js2/bundle.js')
          .expect(200, done);
      });
    });

    describe('should work without "output" options', () => {
      beforeAll((done) => {
        // eslint-disable-next-line no-undefined
        const compiler = getCompiler({ ...webpackConfig, output: undefined });

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return 200 code for GET request to the bundle file', (done) => {
        request(app)
          .get('/main.js')
          .expect(200, done);
      });

      it('should return 404 code for GET request to nonexistent file', (done) => {
        request(app)
          .get('/invalid.js')
          .expect(404, done);
      });

      it('should return 200 code for GET request to non-public path', (done) => {
        request(app)
          .get('/')
          .expect(200, done);
      });
    });

    describe('should work with trailing slash at the end of the "option.path" option', () => {
      beforeAll((done) => {
        // eslint-disable-next-line no-undefined
        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: path.resolve(__dirname, './outputs/basic/'),
          },
        });

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return 200 code for GET request to the bundle file', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, done);
      });

      it('should return 404 code for GET request to nonexistent file', (done) => {
        request(app)
          .get('/invalid.js')
          .expect(404, done);
      });

      it('should return 200 code for GET request to non-public path', (done) => {
        request(app)
          .get('/')
          .expect(200, done);
      });
    });

    describe('should respect "output.publicPath" and "output.path" options', () => {
      beforeAll((done) => {
        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            publicPath: '/static/',
            path: path.resolve(__dirname, '../outputs/other-basic'),
          },
        });

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return 200 code for GET request to the bundle file', (done) => {
        request(app)
          .get('/static/bundle.js')
          .expect(200, done);
      });

      it('should return 404 code for GET request to nonexistent file', (done) => {
        request(app)
          .get('/static/invalid.js')
          .expect(404, done);
      });

      it('should return 404 code for GET request to non-public path', (done) => {
        request(app)
          .get('/')
          .expect(404, done);
      });
    });

    describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackMultiConfig);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return 200 code for GET request to the first bundle file', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect(200, done);
      });

      it('should return 200 code for GET request to the second bundle file', (done) => {
        request(app)
          .get('/js2/bundle.js')
          .expect(200, done);
      });

      it('should return 404 code for GET request to nonexistent file for the first compiler', (done) => {
        request(app)
          .get('/js1/invalid.js')
          .expect(404, done);
      });

      it('should return 404 code for GET request to nonexistent file for the second compiler', (done) => {
        request(app)
          .get('/js2/invalid.js')
          .expect(404, done);
      });

      it('should return 404 code for GET request to nonexistent file', (done) => {
        request(app)
          .get('/static/invalid.js')
          .expect(404, done);
      });

      it('should return 404 code for GET request to non-public path', (done) => {
        request(app)
          .get('/')
          .expect(404, done);
      });
    });

    describe('should respect "output.publicPath" and "output.path" options with hash substitutions', () => {
      beforeAll((done) => {
        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            publicPath: isWebpack5()
              ? '/static/[fullhash]/'
              : '/static/[hash]/',
            path: isWebpack5()
              ? path.resolve(__dirname, '../outputs/other-basic-[fullhash]')
              : path.resolve(__dirname, '../outputs/other-basic-[hash]'),
          },
        });

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return 200 code for GET request to the bundle file', (done) => {
        request(app)
          .get(
            isWebpack5()
              ? '/static/45c13f171499f5100d88/bundle.js'
              : '/static/4c347cd8af8b39e58cbf/bundle.js'
          )
          .expect(200, done);
      });

      it('should return 404 code for GET request to nonexistent file', (done) => {
        request(app)
          .get('/static/invalid.js')
          .expect(404, done);
      });

      it('should return 404 code for GET request to non-public path', (done) => {
        request(app)
          .get('/')
          .expect(404, done);
      });
    });

    describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode with hash substitutions', () => {
      beforeAll((done) => {
        const compiler = getCompiler([
          {
            ...webpackMultiConfig[0],
            output: {
              filename: 'bundle.js',
              path: isWebpack5()
                ? path.resolve(__dirname, './outputs/array-[fullhash]/js1')
                : path.resolve(__dirname, './outputs/array-[hash]/js1'),
              publicPath: isWebpack5()
                ? '/static-one/[fullhash]/'
                : '/static-one/[hash]/',
            },
          },
          {
            ...webpackMultiConfig[1],
            output: {
              filename: 'bundle.js',
              path: isWebpack5()
                ? path.resolve(__dirname, './outputs/array-[fullhash]/js2')
                : path.resolve(__dirname, './outputs/array-[hash]/js2'),
              publicPath: isWebpack5()
                ? '/static-two/[fullhash]/'
                : '/static-two/[hash]/',
            },
          },
        ]);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return 200 code for GET request to the first bundle file', (done) => {
        request(app)
          .get(
            isWebpack5()
              ? '/static-one/a9739b1fa1e4eb31790f/bundle.js'
              : '/static-one/7ed325c92a1d0fe4ce64/bundle.js'
          )
          .expect(200, done);
      });

      it('should return 200 code for GET request to the second bundle file', (done) => {
        request(app)
          .get(
            isWebpack5()
              ? '/static-two/a819fc976c8e917e69c6/bundle.js'
              : '/static-two/db47aa827bb52e5f2e6b/bundle.js'
          )
          .expect(200, done);
      });

      it('should return 404 code for GET request to nonexistent file for the first compiler', (done) => {
        request(app)
          .get('/static-one/invalid.js')
          .expect(404, done);
      });

      it('should return 404 code for GET request to nonexistent file for the second compiler', (done) => {
        request(app)
          .get('/static-two/db47aa827bb52e5f2e6b/invalid.js')
          .expect(404, done);
      });

      it('should return 404 code for GET request to nonexistent file', (done) => {
        request(app)
          .get('/static/invalid.js')
          .expect(404, done);
      });

      it('should return 404 code for GET request to non-public path', (done) => {
        request(app)
          .get('/')
          .expect(404, done);
      });
    });

    describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode, when the "output.publicPath" option presented in only one configuration', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackClientServerConfig);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return 200 code for GET request to the bundle file', (done) => {
        request(app)
          .get('/static/bundle.js')
          .expect(200, done);
      });

      it('should return 404 code for GET request to nonexistent file', (done) => {
        request(app)
          .get('/static/invalid.js')
          .expect(404, done);
      });

      it('should return 200 code for GET request to non-public path', (done) => {
        request(app)
          .get('/')
          .expect(200, done);
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

      afterAll(close);

      it('should return the "200" code for the "GET" request to the bundle file', (done) => {
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

      afterAll(close);

      it('should return the "200" code for the "GET" request to the bundle file', (done) => {
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

      afterAll(close);

      it('should return the "200" code for the "GET" request to the bundle file', (done) => {
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

    describe('should respect the "stats" option in multi-compiler mode', () => {
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

      afterAll(close);

      it('should return the "200" code for the "GET" requests to bundles file', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect(200, (firstError) => {
            if (firstError) {
              return done(firstError);
            }

            return request(app)
              .get('/js2/bundle.js')
              .expect(200, (secondError) => {
                if (secondError) {
                  return done(secondError);
                }

                return request(app)
                  .get('/js3/bundle.js')
                  .expect(200, (thirdError) => {
                    if (thirdError) {
                      return done(thirdError);
                    }

                    expect(getLogsPlugin.logs).toMatchSnapshot();

                    return done();
                  });
              });
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

      afterAll(close);

      it('should return the "200" code for the "GET" request to the bundle file', (done) => {
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

      afterAll(close);

      it('should return the "200" code for the "GET" request to bundle files', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect(200, (firstError) => {
            if (firstError) {
              return done(firstError);
            }

            return request(app)
              .get('/js2/bundle.js')
              .expect(200, (secondError) => {
                if (secondError) {
                  return done(secondError);
                }

                expect(getLogsPlugin.logs).toMatchSnapshot();

                return done();
              });
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

      afterAll(close);

      it('should return the "200" code for "GET" requests to bundle files', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect(200, (firstError) => {
            if (firstError) {
              return done(firstError);
            }

            return request(app)
              .get('/js2/bundle.js')
              .expect(200, (secondError) => {
                if (secondError) {
                  return done(secondError);
                }

                return request(app)
                  .get('/js3/bundle.js')
                  .expect(200, (thirdError) => {
                    if (thirdError) {
                      return done(thirdError);
                    }

                    expect(getLogsPlugin.logs).toMatchSnapshot();

                    return done();
                  });
              });
          });
      });
    });

    describe('should throw an error on "run" when we watching', () => {
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

      it('should logging an error', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            return compiler.run((runError) => {
              expect(() => {
                throw runError;
              }).toThrowErrorMatchingSnapshot();

              done();
            });
          });
      });
    });

    describe('should throw an error on "watch" when we watching', () => {
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

      it('should logging an error', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            return compiler.watch({}, (watchError) => {
              expect(() => {
                throw watchError;
              }).toThrowErrorMatchingSnapshot();

              done();
            });
          });
      });
    });

    describe('should handle an earlier request if a change happened while compiling', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler);

        let invalidated = false;

        compiler.hooks.done.tap('Invalidated', () => {
          if (!invalidated) {
            instance.invalidate();

            invalidated = true;
          }
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to the bundle file', (done) => {
        request(app)
          .get('/bundle.js')
          .expect(200, done);
      });
    });
  });

  describe('mimeTypes option', () => {
    describe('should set the correct value for "Content-Type" header to known MIME type', () => {
      beforeAll((done) => {
        const outputPath = path.resolve(__dirname, './outputs/basic');
        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: outputPath,
          },
        });

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, 'file.html'),
          'welcome'
        );
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to "file.html"', (done) => {
        request(app)
          .get('/file.html')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200, 'welcome', done);
      });
    });

    describe('should set the correct value for "Content-Type" header to unknown MIME type', () => {
      beforeAll((done) => {
        const outputPath = path.resolve(__dirname, './outputs/basic');
        const compiler = getCompiler({
          ...webpackConfig,
          output: {
            filename: 'bundle.js',
            path: outputPath,
          },
        });

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, 'file.phtml'),
          'welcome'
        );
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to "file.html"', (done) => {
        request(app)
          .get('/file.phtml')
          .expect('Content-Type', 'application/octet-stream')
          .expect(200, done);
      });
    });

    describe('should set the correct value for "Content-Type" header to specified MIME type', () => {
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
          mimeTypes: {
            phtml: 'text/html',
          },
        });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);

        instance.context.outputFileSystem.mkdirSync(outputPath, {
          recursive: true,
        });
        instance.context.outputFileSystem.writeFileSync(
          path.resolve(outputPath, 'file.phtml'),
          'welcome'
        );
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request "file.html"', (done) => {
        request(app)
          .get('/file.phtml')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200, 'welcome', done);
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

      afterAll(() => {
        spy.mockRestore();

        close();
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

      afterAll(() => {
        spy.mockRestore();

        close();
      });

      it('should pass arguments to the "watch" method', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect(200, (firstError) => {
            if (firstError) {
              return done(firstError);
            }

            return request(app)
              .get('/js2/bundle.js')
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

      afterAll(() => {
        del.sync(path.posix.resolve(__dirname, './outputs/write-to-disk-true'));

        close();
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

      afterAll(() => {
        del.sync(
          path.posix.resolve(__dirname, './outputs/write-to-disk-function-true')
        );

        close();
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

      afterAll(() => {
        del.sync(
          path.posix.resolve(
            __dirname,
            './outputs/write-to-disk-function-false'
          )
        );

        close();
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

      afterAll(() => {
        del.sync(
          path.posix.resolve(__dirname, './outputs/write-to-disk-query-string')
        );

        close();
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
                './outputs/write-to-disk-multi-compiler/js1'
              ),
              publicPath: '/js1/',
            },
          },
          {
            ...webpackMultiWatchOptionsConfig[1],
            output: {
              filename: 'bundle.js',
              path: path.resolve(
                __dirname,
                './outputs/write-to-disk-multi-compiler/js2'
              ),
              publicPath: '/js2/',
            },
          },
        ]);

        instance = middleware(compiler, { writeToDisk: true });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(() => {
        del.sync(
          path.posix.resolve(
            __dirname,
            './outputs/write-to-disk-multi-compiler/'
          )
        );

        close();
      });

      it('should find the bundle files on disk', (done) => {
        request(app)
          .get('/js1/bundle.js')
          .expect(200, (firstError) => {
            if (firstError) {
              return done(firstError);
            }

            return request(app)
              .get('/js2/bundle.js')
              .expect(200, (secondError) => {
                if (secondError) {
                  return done(secondError);
                }
                const bundleFiles = [
                  './outputs/write-to-disk-multi-compiler/js1/bundle.js',
                  './outputs/write-to-disk-multi-compiler/js1/index.html',
                  './outputs/write-to-disk-multi-compiler/js1/svg.svg',
                  './outputs/write-to-disk-multi-compiler/js2/bundle.js',
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

        listen = listenShorthand(done);
      });

      afterAll(() => {
        del.sync(
          path.posix.resolve(__dirname, './outputs/write-to-disk-with-hash/')
        );

        close();
      });

      it('should find the bundle file on disk', (done) => {
        request(app)
          .get(
            isWebpack5()
              ? '/static/45c13f171499f5100d88/bundle.js'
              : '/static/4c347cd8af8b39e58cbf/bundle.js'
          )
          .expect(200, (error) => {
            if (error) {
              return done(error);
            }

            const bundlePath = isWebpack5()
              ? path.resolve(
                  __dirname,
                  './outputs/write-to-disk-with-hash/dist_45c13f171499f5100d88/bundle.js'
                )
              : path.resolve(
                  __dirname,
                  './outputs/write-to-disk-with-hash/dist_4c347cd8af8b39e58cbf/bundle.js'
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
      request(app)
        .post('/public/bundle.js')
        .expect(200, done);
    });

    it('should return the "404" code for the "GET" request to the bundle file', (done) => {
      request(app)
        .get('/public/bundle.js')
        .expect(404, done);
    });

    it('should return the "200" code for the "HEAD" request to the bundle file', (done) => {
      request(app)
        .head('/public/bundle.js')
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

    it('should return the "200" code for the "GET" request to the bundle file and return headers', (done) => {
      request(app)
        .get('/bundle.js')
        .expect('X-nonsense-1', 'yes')
        .expect('X-nonsense-2', 'no')
        .expect(200, done);
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
        request(app)
          .get('/public/bundle.js')
          .expect(200, done);
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

          expect(locals.webpack.stats).toBeDefined();
          expect(locals.webpack.outputFileSystem).toBeDefined();

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

      it('request to directory', (done) => {
        request(app)
          .get('/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(404, done);
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

      it('should return the "404" code for the "GET" request to the directory', (done) => {
        request(app)
          .get('/')
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

      it('should return the "200" code for the "GET" request to the directory', (done) => {
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

      it('should return the "200" code for the "GET" request to the directory', (done) => {
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

      it('should return the "200" code for the "GET" request to the directory', (done) => {
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

      it('should return the "200" code for the "GET" request to the directory', (done) => {
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

      it('should return the "404" code for the "GET" request to the', (done) => {
        request(app)
          .get('/')
          .expect(404, done);
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

      afterAll(() => {
        isDirectory.mockRestore();

        close();
      });

      it('should logging an error', (done) => {
        request(app)
          .get('/')
          .expect(404, done);
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
          .get('/js1/bundle.js')
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
          .get('/js1/bundle.js')
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
          .get('/js1/bundle.js')
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

      afterAll(() => {
        del.sync(
          path.posix.resolve(__dirname, './outputs/write-to-disk-mkdir-error')
        );

        mkdirSpy.mockRestore();
      });

      it('should logging', (done) => {
        compiler.hooks.failed.tap('FailedCatcher', () => {
          instance.close(() => {
            expect(getLogsPlugin.logs).toMatchSnapshot();

            listen.close(() => {
              done();
            });
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

      afterAll(() => {
        writeFileSpy.mockRestore();

        del.sync(
          path.posix.resolve(
            __dirname,
            './outputs/write-to-disk-writeFile-error'
          )
        );

        close();
      });

      it('should logging', (done) => {
        compiler.hooks.failed.tap('FailedCatcher', () => {
          instance.close(() => {
            expect(getLogsPlugin.logs).toMatchSnapshot();

            listen.close(() => {
              done();
            });
          });
        });
      });
    });
  });
});
