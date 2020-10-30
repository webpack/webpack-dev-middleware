import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '.././helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should respect the value of the "Content-Type" header from other middleware', () => {
  let compiler;
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
  beforeAll((done) => {
    compiler = getCompiler(webpackConfig);

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
  let compiler;
  let instance;
  it('should be no error', (done) => {
    expect(() => {
      compiler = getCompiler();

      compiler.outputPath = '/my/path';

      instance = middleware(compiler);

      instance.close(done);
    }).not.toThrow();
  });
});

describe('should not throw an error on the valid "output.path" value for windows', () => {
  let compiler;
  let instance;

  it('should be no error', (done) => {
    expect(() => {
      compiler = getCompiler();

      compiler.outputPath = 'C:/my/path';

      instance = middleware(compiler);

      instance.close(done);
    }).not.toThrow();
  });
});

describe('should work without "output" options', () => {
  let compiler;
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
  beforeAll((done) => {
    // eslint-disable-next-line no-undefined
    compiler = getCompiler({ ...webpackConfig, output: undefined });

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file', (done) => {
    request(app).get('/main.js').expect(200, done);
  });

  it('should return "404" code for GET request to a nonexistent file', (done) => {
    request(app).get('/invalid.js').expect(404, done);
  });

  it('should return "200" code for GET request to the non-public path', (done) => {
    request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the "index" option', (done) => {
    request(app)
      .get('/index.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });
});
