import express from 'express';
import request from 'supertest';

import middleware from '../../src';

import getCompiler from '.././helpers/getCompiler';
import GetLogsPlugin from '.././helpers/GetLogsPlugin';

import webpackWarningConfig from '.././fixtures/webpack.warning.config';
import webpackMultiWarningConfig from '.././fixtures/webpack.array.warning.config';

describe('should logging an warning', () => {
  let compiler;
  let getLogsPlugin;
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
    compiler = getCompiler(webpackWarningConfig);

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should logging', (done) => {
    request(app)
      .get('/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        instance.invalidate();

        return instance.waitUntilValid(() => {
          expect(getLogsPlugin.logs).toMatchSnapshot();

          done();
        });
      });
  });
});

describe('should logging warnings in multi-compiler mode', () => {
  let compiler;
  let getLogsPlugin;
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
    compiler = getCompiler(webpackMultiWarningConfig);

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should logging', (done) => {
    request(app)
      .get('/static-one/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        instance.invalidate();

        return instance.waitUntilValid(() => {
          expect(getLogsPlugin.logs).toMatchSnapshot();

          done();
        });
      });
  });
});
