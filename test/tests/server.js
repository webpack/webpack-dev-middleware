'use strict';

/* eslint import/no-extraneous-dependencies: off */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const express = require('express');
const webpack = require('webpack');
const request = require('supertest');
const middleware = require('../../');
const webpackConfig = require('../fixtures/server-test/webpack.config');
const webpackMultiConfig = require('../fixtures/server-test/webpack.array.config');
const webpackClientServerConfig = require('../fixtures/server-test/webpack.client.server.config');

describe('Server', () => {
  let instance;
  let listen;
  let app;

  const logLevel = 'error';

  function listenShorthand(done) {
    return app.listen(8000, '127.0.0.1', (err) => {
      if (err) done(err);
      done();
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
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        publicPath: '/public/'
      });
      app.use(instance);
      listen = listenShorthand(done);
      // Hack to add a mock HMR json file to the in-memory filesystem.
      instance.fileSystem.writeFileSync('/123a123412.hot-update.json', '["hi"]');
    });

    after(close);

    it('should not find a bundle file on disk', (done) => {
      request(app).get('/public/bundle.js')
        .expect(200, () => {
          const bundlePath = path.join(__dirname, '../fixtures/server-test/bundle.js');
          assert(!fs.existsSync(bundlePath));
          done();
        });
    });

    it('GET request to bundle file', (done) => {
      request(app).get('/public/bundle.js')
        .expect('Content-Type', 'application/javascript; charset=UTF-8')
        // TODO(michael-ciniawsky) investigate the need for this test
        .expect('Content-Length', '4631')
        .expect(200, /console\.log\('Hey\.'\)/, done);
    });

    it('POST request to bundle file', (done) => {
      request(app).post('/public/bundle.js')
        .expect(404, done);
    });

    it('request to image', (done) => {
      request(app).get('/public/svg.svg')
        .expect('Content-Type', 'image/svg+xml; charset=UTF-8')
        .expect('Content-Length', '4778')
        .expect(200, done);
    });

    it('request to non existing file', (done) => {
      request(app).get('/public/nope')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(404, done);
    });

    it('request to HMR json', (done) => {
      request(app).get('/public/123a123412.hot-update.json')
        .expect('Content-Type', 'application/json; charset=UTF-8')
        .expect(200, /\["hi"\]/, done);
    });

    it('request to directory', (done) => {
      request(app).get('/public/')
        .expect('Content-Type', 'text/html; charset=UTF-8')
        .expect('Content-Length', '10')
        .expect(200, /My Index\./, done);
    });

    it('invalid range header', (done) => {
      request(app).get('/public/svg.svg')
        .set('Range', 'bytes=6000-')
        .expect(416, done);
    });

    it('valid range header', (done) => {
      request(app).get('/public/svg.svg')
        .set('Range', 'bytes=3000-3500')
        .expect('Content-Length', '501')
        .expect('Content-Range', 'bytes 3000-3500/4778')
        .expect(206, done);
    });

    it('request to non-public path', (done) => {
      request(app).get('/nonpublic/')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(404, done);
    });
  });

  describe('accepted methods', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        methods: ['POST'],
        logLevel,
        publicPath: '/public/'
      });
      app.use(instance);
      listen = listenShorthand(done);
    });
    after(close);

    it('POST request to bundle file with methods set to [\'POST\']', (done) => {
      request(app).post('/public/bundle.js')
        .expect('Content-Type', 'application/javascript; charset=UTF-8')
        // TODO(michael-ciniawsky) investigate the need for this test
        .expect('Content-Length', '4631')
        .expect(200, /console\.log\('Hey\.'\)/, done);
    });

    it('GET request to bundle file with methods set to [\'POST\']', (done) => {
      request(app).get('/public/bundle.js')
        .expect(404, done);
    });
  });

  describe('no index mode', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        index: false,
        publicPath: '/'
      });
      app.use(instance);
      listen = listenShorthand(done);
    });
    after(close);

    it('request to directory', (done) => {
      request(app).get('/')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(404, done);
    });
  });

  describe('lazy mode', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        lazy: true,
        publicPath: '/'
      });
      app.use(instance);
      listen = listenShorthand(done);
    });
    after(close);

    it('GET request to bundle file', (done) => {
      request(app).get('/bundle.js')
        // TODO(michael-ciniawsky) investigate the need for this test
        .expect('Content-Length', '4631')
        .expect(200, /console\.log\('Hey\.'\)/, done);
    });
  });

  describe('custom headers', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        headers: { 'X-nonsense-1': 'yes', 'X-nonsense-2': 'no' }
      });
      app.use(instance);
      listen = listenShorthand(done);
    });
    after(close);

    it('request to bundle file', (done) => {
      request(app).get('/bundle.js')
        .expect('X-nonsense-1', 'yes')
        .expect('X-nonsense-2', 'no')
        .expect(200, done);
    });
  });

  describe('no extension support', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        index: 'noextension'
      });
      app.use(instance);
      listen = listenShorthand(done);
      instance.fileSystem.writeFileSync('/noextension', 'hello');
    });
    after(close);

    it('request to noextension', (done) => {
      request(app).get('/')
        .expect('hello')
        .expect('Content-Type', '; charset=UTF-8')
        .expect(200, done);
    });
  });

  describe('custom mimeTypes', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        index: 'Index.phtml',
        mimeTypes: {
          'text/html': ['phtml']
        }
      });
      app.use(instance);
      listen = listenShorthand(done);
      instance.fileSystem.writeFileSync('/Index.phtml', 'welcome');
    });
    after(close);

    it('request to Index.phtml', (done) => {
      request(app).get('/')
        .expect('welcome')
        .expect('Content-Type', /text\/html/)
        .expect(200, done);
    });
  });

  describe('force option for custom mimeTypes', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackClientServerConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        index: 'Index.phtml',
        mimeTypes: {
          typeMap: { 'text/html': ['phtml'] },
          force: true
        }
      });
      app.use(instance);
      listen = listenShorthand(done);
      instance.fileSystem.writeFileSync('/Index.phtml', 'welcome');
    });
    after(close);

    it('request to Index.phtml', (done) => {
      request(app).get('/')
        .expect('welcome')
        .expect('Content-Type', /text\/html/)
        .expect(200, done);
    });
  });

  describe('WebAssembly', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel
      });
      app.use(instance);
      listen = listenShorthand(done);
      instance.fileSystem.writeFileSync('/hello.wasm', 'welcome');
    });
    after(close);

    it('request to hello.wasm', (done) => {
      request(app).get('/hello.wasm')
        .expect('Content-Type', 'application/wasm')
        .expect('welcome')
        .expect(200, done);
    });
  });

  describe('MultiCompiler', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackMultiConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        publicPath: '/'
      });
      app.use(instance);
      listen = listenShorthand(done);
    });
    after(close);

    it('request to both bundle files', (done) => {
      request(app).get('/js1/foo.js')
        .expect(200, () => {
          request(app).get('/js2/bar.js')
            .expect(200, done);
        });
    });
  });

  describe('MultiCompiler: One `publicPath`', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackClientServerConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel
      });
      app.use(instance);
      listen = listenShorthand(done);
    });
    after(close);

    it('request to bundle file', (done) => {
      request(app).get('/static/foo.js').expect(200, done);
    });

    it('request to nonexistent file', (done) => {
      request(app).get('/static/invalid.js').expect(404, done);
    });

    it('request to non-public path', (done) => {
      request(app).get('/').expect(404, done);
    });
  });

  describe('server side render', () => {
    let locals;
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel,
        serverSideRender: true
      });
      app.use(instance);
      app.use((req, res) => {
        locals = res.locals; // eslint-disable-line prefer-destructuring
        res.sendStatus(200);
      });
      listen = listenShorthand(done);
    });
    after(close);

    it('request to bundle file', (done) => {
      request(app).get('/foo/bar')
        .expect(200, () => {
          assert(locals.webpackStats);
          assert(locals.fs);
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
      writeToDisk: value
    });
    app.use(instance);
    app.use((req, res) => {
      res.sendStatus(200);
    });
    listen = listenShorthand(done);
  }

  describe('write to disk', () => {
    before((done) => {
      writeToDisk(true, done);
    });
    after(close);

    it('should find the bundle file on disk', (done) => {
      request(app).get('/foo/bar')
        .expect(200, () => {
          const bundlePath = path.join(__dirname, '../fixtures/server-test/bundle.js');
          assert(fs.existsSync(bundlePath));
          fs.unlinkSync(bundlePath);
          done();
        });
    });
  });

  describe('write to disk with filter', () => {
    before((done) => {
      writeToDisk(filePath => /bundle\.js$/.test(filePath), done);
    });
    after(close);

    it('should find the bundle file on disk', (done) => {
      request(app).get('/foo/bar')
        .expect(200, () => {
          const bundlePath = path.join(__dirname, '../fixtures/server-test/bundle.js');
          assert(fs.existsSync(bundlePath));
          fs.unlinkSync(bundlePath);
          done();
        });
    });
  });

  describe('write to disk with false filter', () => {
    before((done) => {
      writeToDisk(filePath => !(/bundle\.js$/.test(filePath)), done);
    });
    after(close);

    it('should not find the bundle file on disk', (done) => {
      request(app).get('/foo/bar')
        .expect(200, () => {
          const bundlePath = path.join(__dirname, '../fixtures/server-test/bundle.js');
          assert(!fs.existsSync(bundlePath));
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
      writeToDisk: value
    });
    app.use(instance);
    app.use((req, res) => {
      res.sendStatus(200);
    });
    listen = listenShorthand(done);
  }

  describe('write to disk with MultiCompiler', () => {
    before((done) => {
      multiToDisk(true, done);
    });
    after(close);

    it('should find the bundle files on disk', (done) => {
      request(app).get('/foo/bar')
        .expect(200, () => {
          const bundleFiles = [
            '../fixtures/server-test/js1/foo.js',
            '../fixtures/server-test/js1/index.html',
            '../fixtures/server-test/js1/svg.svg',
            '../fixtures/server-test/js2/bar.js'
          ];

          for (const bundleFile of bundleFiles) {
            const bundlePath = path.join(__dirname, bundleFile);
            assert(fs.existsSync(bundlePath));
            fs.unlinkSync(bundlePath);
          }

          fs.rmdirSync(path.join(__dirname, '../fixtures/server-test/js1/'));
          fs.rmdirSync(path.join(__dirname, '../fixtures/server-test/js2/'));

          done();
        });
    });
  });
});
