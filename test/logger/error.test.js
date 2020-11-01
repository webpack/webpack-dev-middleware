import fs from 'fs';
import path from 'path';

import express from 'express';
import del from 'del';

import middleware from '../../src';

import getCompiler from '.././helpers/getCompiler';
import GetLogsPlugin from '.././helpers/GetLogsPlugin';

import webpackConfig from '.././fixtures/webpack.config';
import webpackSimpleConfig from '.././fixtures/webpack.simple.config';

describe('should logging an error in "watch" method', () => {
  let getLogsPlugin;
  let instance;
  it('should logging on startup', () => {
    const compiler = getCompiler(webpackConfig);

    const watchSpy = jest
      .spyOn(compiler, 'watch')
      .mockImplementation((watchOptions, callback) => {
        const error = new Error('Error in Watch method');

        error.stack = '';

        callback(error);

        return { close: () => {} };
      });

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    expect(getLogsPlugin.logs).toMatchSnapshot();

    instance.close();

    watchSpy.mockRestore();
  });
});

describe('should logging an error from the "fs.mkdir" method when the "writeToDisk" option is "true" ', () => {
  let compiler;
  let getLogsPlugin;
  let mkdirSpy;
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
      ...webpackSimpleConfig,
      output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, './outputs/write-to-disk-mkdir-error'),
      },
    });

    mkdirSpy = jest.spyOn(fs, 'mkdir').mockImplementation((...args) => {
      const callback = args[args.length - 1];

      return callback(new Error('Error in the "fs.mkdir" method.'));
    });

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler, { writeToDisk: true });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll((done) => {
    del.sync(
      path.posix.resolve(__dirname, './outputs/write-to-disk-mkdir-error')
    );

    mkdirSpy.mockRestore();

    close(done);
  });

  it('should logging', (done) => {
    compiler.hooks.failed.tap('FailedCatcher', () => {
      instance.close(() => {
        expect(getLogsPlugin.logs).toMatchSnapshot();

        done();
      });
    });
  });
});

describe('should logging an error from the "fs.writeFile" method when the "writeToDisk" option is "true" ', () => {
  let compiler;
  let getLogsPlugin;
  let writeFileSpy;
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
      ...webpackSimpleConfig,
      output: {
        filename: 'bundle.js',
        path: path.resolve(
          __dirname,
          './outputs/write-to-disk-writeFile-error'
        ),
      },
    });

    writeFileSpy = jest.spyOn(fs, 'writeFile').mockImplementation((...args) => {
      const callback = args[args.length - 1];

      return callback(new Error('Error in the "fs.writeFile" method.'));
    });

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler, { writeToDisk: true });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll((done) => {
    writeFileSpy.mockRestore();

    del.sync(
      path.posix.resolve(__dirname, './outputs/write-to-disk-writeFile-error')
    );

    close(done);
  });

  it('should logging', (done) => {
    compiler.hooks.failed.tap('FailedCatcher', () => {
      instance.close(() => {
        expect(getLogsPlugin.logs).toMatchSnapshot();

        done();
      });
    });
  });
});
