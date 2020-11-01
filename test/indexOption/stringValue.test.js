import path from 'path';

import express from 'express';
import request from 'supertest';

import middleware from '../../src';

import getCompiler from '.././helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should work with "string" value', () => {
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
      index: 'default.html',
      publicPath: '/',
    });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);

    instance.context.outputFileSystem.mkdirSync(outputPath, {
      recursive: true,
    });
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'default.html'),
      'hello'
    );
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to the public path', (done) => {
    request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });
});

describe('should work with "string" value with a custom extension', () => {
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
      index: 'index.custom',
      publicPath: '/',
    });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);

    instance.context.outputFileSystem.mkdirSync(outputPath, {
      recursive: true,
    });
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'index.custom'),
      'hello'
    );
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to the public path', (done) => {
    request(app)
      .get('/')
      .expect('Content-Type', 'application/octet-stream')
      .expect(200, done);
  });
});

describe('should work with "string" value with a custom extension and defined a custom MIME type', () => {
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
      index: 'index.custom',
      mimeTypes: {
        custom: 'text/html',
      },
      publicPath: '/',
    });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);

    instance.context.outputFileSystem.mkdirSync(outputPath, {
      recursive: true,
    });
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'index.custom'),
      'hello'
    );
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to the public path', (done) => {
    request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });
});

describe('should work with "string" value without an extension', () => {
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

    instance = middleware(compiler, { index: 'noextension' });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);

    instance.context.outputFileSystem.mkdirSync(outputPath, {
      recursive: true,
    });
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'noextension'),
      'hello'
    );
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to the public path', (done) => {
    request(app)
      .get('/')
      .expect('Content-Type', 'application/octet-stream')
      .expect(200, done);
  });
});

describe('should work with "string" value but the "index" option is a directory', () => {
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
      index: 'custom.html',
      publicPath: '/',
    });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);

    instance.context.outputFileSystem.mkdirSync(outputPath, {
      recursive: true,
    });
    instance.context.outputFileSystem.mkdirSync(
      path.resolve(outputPath, 'custom.html')
    );
  });

  afterAll(close);

  it('should return the "404" code for the "GET" request to the public path', (done) => {
    request(app).get('/').expect(404, done);
  });
});

describe('should not handle request when index is neither a file nor a directory', () => {
  let compiler;
  let isDirectory;
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

    instance = middleware(compiler, {
      index: 'default.html',
      publicPath: '/',
    });

    isDirectory = jest
      .spyOn(instance.context.outputFileSystem, 'statSync')
      .mockImplementation(() => {
        return {
          isFile: () => false,
          isDirectory: () => false,
        };
      });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll((done) => {
    isDirectory.mockRestore();

    close(done);
  });

  it('should return the "404" code for the "GET" request to the public path', (done) => {
    request(app).get('/').expect(404, done);
  });
});
