import path from 'path';

import express from 'express';
import request from 'supertest';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should override value for "Content-Type" header for known MIME type', () => {
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

    listen = listenShorthand(done);

    instance.context.outputFileSystem.mkdirSync(outputPath, {
      recursive: true,
    });
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'file.jpg'),
      'welcome'
    );
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request "file.jpg"', (done) => {
    request(app)
      .get('/file.jpg')
      .expect('Content-Type', /application\/octet-stream/)
      .expect(200, done);
  });
});
