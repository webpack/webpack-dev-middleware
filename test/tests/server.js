'use strict';

/* eslint import/no-extraneous-dependencies: off */

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
        logLevel: 'silent',
        publicPath: '/public/'
      });
      app.use(instance);
      listen = listenShorthand(done);
      // Hack to add a mock HMR json file to the in-memory filesystem.
      instance.fileSystem.writeFileSync('/123a123412.hot-update.json', '["hi"]');
    });

    after(close);

    it('GET request to bundle file', (done) => {
      request(app).get('/public/bundle.js')
        .expect('Content-Type', 'application/javascript; charset=UTF-8')
        .expect('Content-Length', '3451')
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

  describe('no index mode', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel: 'silent',
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
        logLevel: 'silent',
        lazy: true,
        publicPath: '/'
      });
      app.use(instance);
      listen = listenShorthand(done);
    });
    after(close);

    it('GET request to bundle file', (done) => {
      request(app).get('/bundle.js')
        .expect('Content-Length', '3451')
        .expect(200, /console\.log\('Hey\.'\)/, done);
    });
  });

  describe('custom headers', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel: 'silent',
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

  describe('custom mimeTypes', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel: 'silent',
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

  describe('WebAssembly', () => {
    before((done) => {
      app = express();
      const compiler = webpack(webpackConfig);
      instance = middleware(compiler, {
        stats: 'errors-only',
        logLevel: 'silent'
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
        logLevel: 'silent',
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
        logLevel: 'silent'
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
        logLevel: 'silent',
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
          done();
        });
    });
  });
});
