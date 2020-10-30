import express from 'express';
import memfs from 'memfs';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should work with an unspecified value', () => {
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
    compiler = getCompiler(webpackConfig);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should use the "memfs" package by default', () => {
    const { Stats } = memfs;

    expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
    expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(Stats);
    expect(compiler.outputFileSystem).toHaveProperty('join');
    expect(compiler.outputFileSystem).toHaveProperty('mkdirp');
  });
});
