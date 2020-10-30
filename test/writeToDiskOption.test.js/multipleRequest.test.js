import path from 'path';
import fs from 'fs';

import express from 'express';
import request from 'supertest';
import del from 'del';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';
import isWebpack5 from '.././helpers/isWebpack5';

import webpackConfig from '.././fixtures/webpack.config';
import webpackQueryStringConfig from '.././fixtures/webpack.querystring.config';
import webpackMultiWatchOptionsConfig from '.././fixtures/webpack.array.watch-options.config';

describe('should work when assets have query string', () => {
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
      ...webpackQueryStringConfig,
      output: {
        filename: 'bundle.js?[contenthash]',
        path: path.resolve(__dirname, './outputs/write-to-disk-query-string'),
      },
    });

    instance = middleware(compiler, { writeToDisk: true });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll((done) => {
    del.sync(
      path.posix.resolve(__dirname, './outputs/write-to-disk-query-string')
    );

    close(done);
  });

  it('should find the bundle file on disk with no querystring', (done) => {
    request(app)
      .get('/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        const bundlePath = path.resolve(
          __dirname,
          './outputs/write-to-disk-query-string/bundle.js'
        );

        expect(fs.existsSync(bundlePath)).toBe(true);

        return done();
      });
  });
});

describe('should work in multi-compiler mode', () => {
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
    compiler = getCompiler([
      {
        ...webpackMultiWatchOptionsConfig[0],
        output: {
          filename: 'bundle.js',
          path: path.resolve(
            __dirname,
            './outputs/write-to-disk-multi-compiler/static-one'
          ),
          publicPath: '/static-one/',
        },
      },
      {
        ...webpackMultiWatchOptionsConfig[1],
        output: {
          filename: 'bundle.js',
          path: path.resolve(
            __dirname,
            './outputs/write-to-disk-multi-compiler/static-two'
          ),
          publicPath: '/static-two/',
        },
      },
    ]);

    instance = middleware(compiler, { writeToDisk: true });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll((done) => {
    del.sync(
      path.posix.resolve(__dirname, './outputs/write-to-disk-multi-compiler/')
    );

    close(done);
  });

  it('should find the bundle files on disk', (done) => {
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
            const bundleFiles = [
              './outputs/write-to-disk-multi-compiler/static-one/bundle.js',
              './outputs/write-to-disk-multi-compiler/static-one/index.html',
              './outputs/write-to-disk-multi-compiler/static-one/svg.svg',
              './outputs/write-to-disk-multi-compiler/static-two/bundle.js',
            ];

            for (const bundleFile of bundleFiles) {
              const bundlePath = path.resolve(__dirname, bundleFile);

              expect(fs.existsSync(bundlePath)).toBe(true);
            }

            return done();
          });
      });
  });
});

describe('should work with "[hash]"/"[fullhash]" in the "output.path" and "output.publicPath" option', () => {
  let compiler;
  let hash;
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
      ...{
        output: {
          filename: 'bundle.js',
          publicPath: isWebpack5() ? '/static/[fullhash]/' : '/static/[hash]/',
          path: isWebpack5()
            ? path.resolve(
                __dirname,
                './outputs/write-to-disk-with-hash/dist_[fullhash]'
              )
            : path.resolve(
                __dirname,
                './outputs/write-to-disk-with-hash/dist_[hash]'
              ),
        },
      },
    });

    instance = middleware(compiler, { writeToDisk: true });

    app = express();
    app.use(instance);

    listen = listenShorthand(() => {
      compiler.hooks.afterCompile.tap('wdm-test', ({ hash: h }) => {
        hash = h;
        done();
      });
    });
  });

  afterAll((done) => {
    del.sync(
      path.posix.resolve(__dirname, './outputs/write-to-disk-with-hash/')
    );

    close(done);
  });

  it('should find the bundle file on disk', (done) => {
    request(app)
      .get(`/static/${hash}/bundle.js`)
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        const bundlePath = path.resolve(
          __dirname,
          `./outputs/write-to-disk-with-hash/dist_${hash}/bundle.js`
        );

        expect(fs.existsSync(bundlePath)).toBe(true);

        return done();
      });
  });
});
