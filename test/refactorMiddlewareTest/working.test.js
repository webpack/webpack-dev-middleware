import path from 'path';

import fs from 'fs';

import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '.././helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';

describe('should work', () => {
  let compiler;
  let codeLength;
  let instance;
  let app;
  let listen;
  const outputPath = path.resolve(__dirname, './outputs/basic');

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
        path: outputPath,
      },
    });

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(() => {
      compiler.hooks.afterCompile.tap('wdm-test', (params) => {
        codeLength = params.assets['bundle.js'].source().length;
        done();
      });
    });

    instance.context.outputFileSystem.mkdirSync(outputPath, {
      recursive: true,
    });
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'image.svg'),
      'svg image'
    );
    instance.context.outputFileSystem.mkdirSync(
      path.resolve(outputPath, 'directory/nested-directory'),
      { recursive: true }
    );
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'directory/nested-directory/index.html'),
      'My Index.'
    );
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'throw-an-exception-on-readFileSync.txt'),
      'exception'
    );
    instance.context.outputFileSystem.writeFileSync(
      path.resolve(outputPath, 'unknown'),
      'unknown'
    );
  });

  afterAll(close);

  it('should not find the bundle file on disk', (done) => {
    request(app)
      .get('/bundle.js')
      .expect('Content-Type', 'application/javascript; charset=utf-8')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        expect(fs.existsSync(path.resolve(outputPath, 'bundle.js'))).toBe(
          false
        );

        return done();
      });
  });

  it('should return the "200" code for the "GET" request to the bundle file', (done) => {
    const fileData = instance.context.outputFileSystem.readFileSync(
      path.resolve(outputPath, 'bundle.js')
    );

    request(app)
      .get('/bundle.js')
      .expect('Content-Length', fileData.byteLength.toString())
      .expect('Content-Type', 'application/javascript; charset=utf-8')
      .expect(200, fileData.toString(), done);
  });

  it('should return the "200" code for the "HEAD" request to the bundle file', (done) => {
    request(app)
      .head('/bundle.js')
      .expect(
        'Content-Length',
        instance.context.outputFileSystem
          .readFileSync(path.resolve(outputPath, 'bundle.js'))
          .byteLength.toString()
      )
      .expect('Content-Type', 'application/javascript; charset=utf-8')
      // eslint-disable-next-line no-undefined
      .expect(200, undefined, done);
  });

  it('should return the "404" code for the "POST" request to the bundle file', (done) => {
    request(app).post('/bundle.js').expect(404, done);
  });

  it('should return the "200" code for the "GET" request to the "image.svg" file', (done) => {
    const fileData = instance.context.outputFileSystem.readFileSync(
      path.resolve(outputPath, 'image.svg')
    );

    request(app)
      .get('/image.svg')
      .expect('Content-Length', fileData.byteLength.toString())
      .expect('Content-Type', 'image/svg+xml')
      .expect(200, fileData, done);
  });

  it('should return the "200" code for the "GET" request to the directory', (done) => {
    const fileData = fs.readFileSync(
      path.resolve(__dirname, '../../test/fixtures/index.html')
    );

    request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect('Content-Length', fileData.byteLength.toString())
      .expect(200, fileData.toString(), done);
  });

  it('should return the "200" code for the "GET" request to the subdirectory with "index.html"', (done) => {
    const fileData = instance.context.outputFileSystem.readFileSync(
      path.resolve(outputPath, 'directory/nested-directory/index.html')
    );

    request(app)
      .get('/directory/nested-directory/')
      .expect('Content-Length', fileData.byteLength.toString())
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, fileData.toString(), done);
  });

  it('should return the "200" code for the "GET" request to the subdirectory with "index.html" without trailing slash', (done) => {
    const fileData = instance.context.outputFileSystem.readFileSync(
      path.resolve(outputPath, 'directory/nested-directory/index.html')
    );
    request(app)
      .get('/directory/nested-directory')
      .expect('Content-Length', fileData.byteLength.toString())
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, fileData.toString(), done);
  });

  it('should return the "200" code for the "GET" request to the subdirectory with "index.html"', (done) => {
    const fileData = instance.context.outputFileSystem.readFileSync(
      path.resolve(outputPath, 'directory/nested-directory/index.html')
    );

    request(app)
      .get('/directory/nested-directory/index.html')
      .expect('Content-Length', fileData.byteLength.toString())
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, fileData.toString(), done);
  });

  it('should return the "416" code for the "GET" request with the invalid range header', (done) => {
    request(app)
      .get('/bundle.js')
      .set('Range', 'bytes=9999999-')
      .expect(416, done);
  });

  it('should return the "206" code for the "GET" request with the valid range header', (done) => {
    request(app)
      .get('/bundle.js')
      .set('Range', 'bytes=3000-3500')
      .expect('Content-Length', '501')
      .expect('Content-Range', `bytes 3000-3500/${codeLength}`)
      .expect(206, done);
  });

  it('should return the "200" code for the "GET" request with malformed range header which is ignored', (done) => {
    request(app).get('/bundle.js').set('Range', 'abc').expect(200, done);
  });

  it('should return the "200" code for the "GET" request with multiple range header which is ignored', (done) => {
    request(app)
      .get('/bundle.js')
      .set('Range', 'bytes=3000-3100,3200-3300')
      .expect(200, done);
  });

  it('should return the "404" code for the "GET" request with to the non-public path', (done) => {
    request(app)
      .get('/nonpublic/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(404, done);
  });

  it('should return the "404" code for the "GET" request to the deleted file', (done) => {
    const spy = jest
      .spyOn(instance.context.outputFileSystem, 'readFileSync')
      .mockImplementation(() => {
        throw new Error('error');
      });

    request(app)
      .get('/public/throw-an-exception-on-readFileSync.txt')
      .expect(404, (error) => {
        if (error) {
          return done(error);
        }

        spy.mockRestore();

        return done();
      });
  });

  it('should return "200" code code for the "GET" request to the file without extension', (done) => {
    const fileData = instance.context.outputFileSystem.readFileSync(
      path.resolve(outputPath, 'unknown')
    );

    request(app)
      .get('/unknown')
      .expect('Content-Length', fileData.byteLength.toString())
      .expect('Content-Type', 'application/octet-stream')
      .expect(200, done);
  });
});
