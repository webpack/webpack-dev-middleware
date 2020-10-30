import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should work without value', () => {
  let compiler;
  let spy;
  let instance;
  let listen;
  let app;

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

    spy = jest.spyOn(compiler, 'watch');

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll((done) => {
    spy.mockRestore();

    close(done);
  });

  it('should pass arguments to the "watch" method', (done) => {
    request(app)
      .get('/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toEqual({});

        return done();
      });
  });
});
