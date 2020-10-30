import path from 'path';

import express from 'express';
import request from 'supertest';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should set the correct value for "Content-Type" header to known MIME type', () => {
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

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);

    instance.context.outputFileSystem.mkdirSync(outputPath, {
      recursive: true,
    });
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'file.html'),
      'welcome'
    );
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to "file.html"', (done) => {
    request(app)
      .get('/file.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, 'welcome', done);
  });
});

describe('should set the correct value for "Content-Type" header to unknown MIME type', () => {
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

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);

    instance.context.outputFileSystem.mkdirSync(outputPath, {
      recursive: true,
    });
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'file.phtml'),
      'welcome'
    );
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to "file.phtml"', (done) => {
    request(app)
      .get('/file.phtml')
      .expect('Content-Type', 'application/octet-stream')
      .expect(200, done);
  });
});

describe('should set the correct value for "Content-Type" header to specified MIME type', () => {
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
        phtml: 'text/html',
      },
    });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);

    instance.context.outputFileSystem.mkdirSync(outputPath, {
      recursive: true,
    });
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'file.phtml'),
      'welcome'
    );
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request "file.phtml"', (done) => {
    request(app)
      .get('/file.phtml')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, 'welcome', done);
  });
});
