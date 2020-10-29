import path from 'path';

import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '.././helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should not work with the broken "publicPath" option', () => {
  let compiler;
  let instance;
  let app;
  let listen;
  const outputPath = path.resolve(__dirname, './outputs/basic');

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
    compiler = getCompiler({
      ...webpackConfig,
      output: {
        filename: 'bundle.js',
        path: outputPath,
        publicPath: 'https://test:malfor%5Med@test.example.com',
      },
    });

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return the "400" code for the "GET" request to the bundle file', (done) => {
    request(app).get('/bundle.js').expect(404, done);
  });
});
