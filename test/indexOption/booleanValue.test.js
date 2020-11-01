import express from 'express';
import request from 'supertest';

import middleware from '../../src';

import getCompiler from '.././helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should work with "false" value', () => {
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
