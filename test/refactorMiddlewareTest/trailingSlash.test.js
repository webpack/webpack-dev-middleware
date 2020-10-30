import path from 'path';

import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';

import webpackConfig from '../fixtures/webpack.config';

describe('should work with trailing slash at the end of the "option.path" option', () => {
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

  it('should return "200" code for GET request to the bundle file', (done) => {
    request(app).get('/bundle.js').expect(200, done);
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
