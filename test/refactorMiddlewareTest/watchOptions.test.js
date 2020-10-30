import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';

import GetLogsPlugin from '.././helpers/GetLogsPlugin';

import webpackConfig from '.././fixtures/webpack.config';

describe('should throw an error on "run" when we watching', () => {
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
    compiler = getCompiler(webpackConfig);

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should logging an error', (done) => {
    request(app)
      .get('/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        return compiler.run((runError) => {
          expect(() => {
            throw runError;
          }).toThrowErrorMatchingSnapshot();

          done();
        });
      });
  });
});

describe('should throw an error on "watch" when we watching', () => {
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
    compiler = getCompiler(webpackConfig);

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should logging an error', (done) => {
    request(app)
      .get('/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        return compiler.watch({}, (watchError) => {
          expect(() => {
            throw watchError;
          }).toThrowErrorMatchingSnapshot();

          done();
        });
      });
  });
});

describe('should handle an earlier request if a change happened while compiling', () => {
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

    instance = middleware(compiler);

    let invalidated = false;

    compiler.hooks.done.tap('Invalidated', () => {
      if (!invalidated) {
        instance.invalidate();

        invalidated = true;
      }
    });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to the bundle file', (done) => {
    request(app).get('/bundle.js').expect(200, done);
  });
});
