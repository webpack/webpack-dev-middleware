import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '.././helpers/getCompiler';

import webpackMultiConfig from '.././fixtures/webpack.array.config';

describe('should work in multi-compiler mode', () => {
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
    compiler = getCompiler(webpackMultiConfig);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file for the first compiler', (done) => {
    request(app).get('/static-one/bundle.js').expect(200, done);
  });

  it('should return "404" code for GET request to a non existing file for the first compiler', (done) => {
    request(app).get('/static-one/invalid.js').expect(404, done);
  });

  it('should return "200" code for GET request to the "public" path for the first compiler', (done) => {
    request(app)
      .get('/static-one/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the "index" option for the first compiler', (done) => {
    request(app)
      .get('/static-one/index.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request for the bundle file for the second compiler', (done) => {
    request(app).get('/static-two/bundle.js').expect(200, done);
  });

  it('should return "404" code for GET request to a non existing file for the second compiler', (done) => {
    request(app).get('/static-two/invalid.js').expect(404, done);
  });

  it('should return "404" code for GET request to the "public" path for the second compiler', (done) => {
    request(app).get('/static-two/').expect(404, done);
  });

  it('should return "404" code for GET request to the "index" option for the second compiler', (done) => {
    request(app).get('/static-two/index.html').expect(404, done);
  });

  it('should return "404" code for GET request to the non-public path', (done) => {
    request(app)
      .get('/static-three/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(404, done);
  });

  it('should return "404" code for GET request to the non-public path', (done) => {
    request(app)
      .get('/static-three/invalid.js')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(404, done);
  });

  it('should return "404" code for GET request to the non-public path', (done) => {
    request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(404, done);
  });
});
