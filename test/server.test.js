import fs from 'fs';
import path from 'path';

import express from 'express';
import webpack from 'webpack';
import request from 'supertest';

import middleware from '../src';

import { mockRequest, mockResponse } from './mock-express';

import webpackConfig from './fixtures/server-test/webpack.config';
import webpackMultiConfig from './fixtures/server-test/webpack.array.config';
import webpackQuerystringConfig from './fixtures/server-test/webpack.querystring.config';
import webpackClientServerConfig from './fixtures/server-test/webpack.client.server.config';

describe('Server', () => {
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

  describe('requests', () => {
    beforeAll((done) => {
      app = express();
      const compiler = webpack({
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
      // Hack to add a mock HMR json file to the in-memory filesystem.
      instance.fileSystem.writeFileSync(
        '/123a123412.hot-update.json',
        '["hi"]'
      );

      // Add a nested directory and index.html inside
      instance.fileSystem.mkdirSync('/reference');
      instance.fileSystem.mkdirSync('/reference/mono-v6.x.x');
      instance.fileSystem.writeFileSync(
        '/reference/mono-v6.x.x/index.html',
        'My Index.'
      );
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
      request(app)
        .get('/public/bundle.js')
        .expect('Content-Type', 'application/javascript; charset=UTF-8')
        .expect(200, /console\.log\('Hey\.'\)/, done);
    });

    it('HEAD request to bundle file', (done) => {
      request(app)
        .head('/public/bundle.js')
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
      request(app)
        .get('/public/svg.svg')
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
      request(app)
        .get('/public/123a123412.hot-update.json')
        .expect('Content-Type', 'application/json; charset=UTF-8')
        .expect(200, /\["hi"\]/, done);
    });

    it('request to directory', (done) => {
      request(app)
        .get('/public/')
        .expect('Content-Type', 'text/html; charset=UTF-8')
        .expect('Content-Length', '10')
        .expect(200, /My Index\./, done);
    });

    it('request to subdirectory without trailing slash', (done) => {
      request(app)
        .get('/public/reference/mono-v6.x.x')
        .expect('Content-Type', 'text/html; charset=UTF-8')
        .expect('Content-Length', '9')
        .expect(200, /My Index\./, done);
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
  });

  describe('accepted methods', () => {
    beforeAll((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
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

  describe('no index mode', () => {
    beforeAll((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
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

  describe('lazy mode', () => {
    beforeAll((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
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

  describe('custom headers', () => {
    beforeAll((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        headers: { 'X-nonsense-1': 'yes', 'X-nonsense-2': 'no' },
      });
      app.use(instance);
      listen = listenShorthand(done);
    });
    afterAll(close);

    it('request to bundle file', (done) => {
      request(app)
        .get('/bundle.js')
        .expect('X-nonsense-1', 'yes')
        .expect('X-nonsense-2', 'no')
        .expect(200, done);
    });
  });

  describe('no extension support', () => {
    beforeAll((done) => {
      app = express();
      const compiler = webpack({
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
      instance.fileSystem.writeFileSync('/noextension', 'hello');
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

  describe('custom Content-Type', () => {
    beforeAll((done) => {
      app = express();
      app.use((req, res, next) => {
        res.set('Content-Type', 'application/octet-stream');
        next();
      });
      const compiler = webpack(webpackConfig);
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

  /**
   * ref: #385, for that koa-webpack@4.x doesn't pass in res.getHeader method.
   */
  describe('Should work when res.getHeader is undefined', () => {
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

      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
      });

      instance(req, res, jest.fn()).then(done);
    });
    afterAll(close);
  });

  describe('custom mimeTypes', () => {
    beforeAll((done) => {
      app = express();
      const compiler = webpack({
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
      instance.fileSystem.writeFileSync('/Index.phtml', 'welcome');
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

  describe('force option for custom mimeTypes', () => {
    beforeAll((done) => {
      app = express();
      const compiler = webpack({
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
      instance.fileSystem.writeFileSync('/Index.phtml', 'welcome');
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

  describe('special file type headers', () => {
    beforeAll((done) => {
      app = express();
      const compiler = webpack({
        ...webpackConfig,
        output: {
          filename: 'bundle.js',
          path: '/',
        },
      });
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        mimeTypes: {
          typeMap: {
            'model/vnd.pixar.usd': ['usdz'],
          },
          force: true,
        },
      });
      app.use(instance);
      listen = listenShorthand(done);
      instance.fileSystem.writeFileSync('/hello.wasm', 'welcome');
      instance.fileSystem.writeFileSync('/3dAr.usdz', '010101');
    });
    afterAll(close);

    it('request to hello.wasm', (done) => {
      request(app)
        .get('/hello.wasm')
        .expect('Content-Type', 'application/wasm')
        .expect('welcome')
        .expect(200, done);
    });

    it('request to 3dAr.usdz', (done) => {
      request(app)
        .get('/3dAr.usdz')
        .expect('Content-Type', 'model/vnd.pixar.usd')
        .expect('010101')
        .expect(200, done);
    });
  });

  describe('multi compiler', () => {
    beforeAll((done) => {
      app = express();
      const compiler = webpack(webpackMultiConfig);
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

  describe('multi compiler: one `publicPath`', () => {
    beforeAll((done) => {
      app = express();
      const compiler = webpack(webpackClientServerConfig);
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

  describe('server side render', () => {
    let locals;
    beforeAll((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        serverSideRender: true,
      });
      app.use(instance);
      app.use((req, res) => {
        locals = res.locals; // eslint-disable-line prefer-destructuring
        res.sendStatus(200);
      });
      listen = listenShorthand(done);
    });
    afterAll(close);

    it('request to bundle file', (done) => {
      request(app)
        .get('/foo/bar')
        .expect(200, () => {
          expect(locals.webpackStats).toBeDefined();
          expect(locals.fs).toBeDefined();

          done();
        });
    });
  });

  function writeToDisk(value, done) {
    app = express();

    const compiler = webpack(webpackConfig);

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

    return { compiler, instance };
  }

  describe('write to disk with true', () => {
    beforeAll((done) => {
      writeToDisk(true, done);
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

  describe('write to disk with false', () => {
    beforeAll((done) => {
      writeToDisk(false, done);
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

  describe('write to disk with filter', () => {
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

  describe('write to disk with false filter', () => {
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

  function querystringToDisk(value, done) {
    app = express();
    const compiler = webpack(webpackQuerystringConfig);
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
  }

  describe('write to disk without including querystrings', () => {
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

  function multiToDisk(value, done) {
    app = express();

    const compiler = webpack(webpackMultiConfig);

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
  }

  describe('write to disk with MultiCompiler', () => {
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

  describe('write to disk with true hooks', () => {
    let compiler = null;

    beforeAll((done) => {
      ({ compiler, instance } = writeToDisk(true, done));
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
          ).toBe(1);
          expect(fs.existsSync(bundlePath)).toBe(true);

          fs.unlinkSync(bundlePath);

          done();
          // Todo uncomment when webpack fix problem `TypeError: this.watcher.getContextTimeInfoEntries is not a function`
          /*
          instance.invalidate();

          compiler.hooks.done.tap('WebpackDevMiddlewareWriteToDiskTest', () => {
            expect(
              compiler.hooks.assetEmitted.taps.filter(
                (hook) => hook.name === 'WebpackDevMiddleware'
              ).length
            ).toBe(1);

            done();
          });
          */
        });
    });
  });

  describe('write to disk with false hooks', () => {
    let compiler = null;

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

          done();

          // Todo uncomment when webpack fix problem `TypeError: this.watcher.getContextTimeInfoEntries is not a function`
          /*
          instance.invalidate();

          compiler.hooks.done.tap('WebpackDevMiddlewareWriteToDiskTest', () => {
            expect(
              compiler.hooks.assetEmitted.taps.filter(
                (hook) => hook.name === 'WebpackDevMiddleware'
              ).length
            ).toBe(0);

            done();
          });
           */
        });
    });
  });
});
