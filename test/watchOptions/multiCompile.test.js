import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';

import webpackMultiWatchOptionsConfig from '.././fixtures/webpack.array.watch-options.config';

describe('should respect options from the configuration in multi-compile mode', () => {
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
    compiler = getCompiler(webpackMultiWatchOptionsConfig);

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
      .get('/static-one/bundle.js')
      .expect(200, (firstError) => {
        if (firstError) {
          return done(firstError);
        }

        return request(app)
          .get('/static-two/bundle.js')
          .expect(200, (secondError) => {
            if (secondError) {
              return done(secondError);
            }

            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][0]).toEqual([
              { aggregateTimeout: 800, poll: false },
              { aggregateTimeout: 300, poll: true },
            ]);

            return done();
          });
      });
  });
});
