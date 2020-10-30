import path from 'path';
import fs from 'fs';

import express from 'express';
import request from 'supertest';
import del from 'del';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should work with "Function" value when it returns "true"', () => {
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
    compiler = getCompiler({
      ...webpackConfig,
      output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, './outputs/write-to-disk-function-true'),
      },
    });

    instance = middleware(compiler, {
      writeToDisk: (filePath) => /bundle\.js$/.test(filePath),
    });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll((done) => {
    del.sync(
      path.posix.resolve(__dirname, './outputs/write-to-disk-function-true')
    );

    close(done);
  });

  it('should find the bundle file on disk', (done) => {
    request(app)
      .get('/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        const bundlePath = path.resolve(
          __dirname,
          './outputs/write-to-disk-function-true/bundle.js'
        );

        expect(fs.existsSync(bundlePath)).toBe(true);

        return done();
      });
  });
});

describe('should work with "Function" value when it returns "false"', () => {
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
    compiler = getCompiler({
      ...webpackConfig,
      output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, './outputs/write-to-disk-function-false'),
      },
    });

    instance = middleware(compiler, {
      writeToDisk: (filePath) => !/bundle\.js$/.test(filePath),
    });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll((done) => {
    del.sync(
      path.posix.resolve(__dirname, './outputs/write-to-disk-function-false')
    );

    close(done);
  });

  it('should not find the bundle file on disk', (done) => {
    request(app)
      .get('/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        const bundlePath = path.resolve(
          __dirname,
          './outputs/write-to-disk-function-false/bundle.js'
        );

        expect(fs.existsSync(bundlePath)).toBe(false);

        return done();
      });
  });
});
