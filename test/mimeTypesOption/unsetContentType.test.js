import path from 'path';

import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should not set "Content-Type" header for route not from outputFileSystem', () => {
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
        jpg: 'application/octet-stream',
      },
    });

    app = express();
    app.use(instance);

    app.get('/file.jpg', (req, res) => {
      res.send('welcome');
    });

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request "file.jpg" with default content type', (done) => {
    request(app)
      .get('/file.jpg')
      .expect('Content-Type', /text\/html/)
      .expect(200, done);
  });
});
