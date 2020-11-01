import express from 'express';
import request from 'supertest';

import middleware from '../src';

import getCompiler from './helpers/getCompiler';

import webpackConfig from './fixtures/webpack.config';

describe('middleware', () => {
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

      return;
    }

    instance.close(() => {
      if (listen) {
        listen.close(done);
      } else {
        done();
      }
    });
  }

  describe('methods option', () => {
    let compiler;

    beforeAll((done) => {
      compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        methods: ['POST'],
        publicPath: '/public/',
      });

      app = express();
      app.use(instance);

      listen = listenShorthand(done);
    });

    afterAll(close);

    it('should return the "200" code for the "POST" request to the bundle file', (done) => {
      request(app).post('/public/bundle.js').expect(200, done);
    });

    it('should return the "404" code for the "GET" request to the bundle file', (done) => {
      request(app).get('/public/bundle.js').expect(404, done);
    });

    it('should return the "200" code for the "HEAD" request to the bundle file', (done) => {
      request(app).head('/public/bundle.js').expect(404, done);
    });
  });

  describe('headers option', () => {
    beforeEach((done) => {
      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, {
        headers: { 'X-nonsense-1': 'yes', 'X-nonsense-2': 'no' },
      });

      app = express();
      app.use(instance);

      listen = listenShorthand(done);
    });

    afterEach(close);

    it('should return the "200" code for the "GET" request to the bundle file and return headers', (done) => {
      request(app)
        .get('/bundle.js')
        .expect('X-nonsense-1', 'yes')
        .expect('X-nonsense-2', 'no')
        .expect(200, done);
    });

    it('should return the "200" code for the "GET" request to path not in outputFileSystem but not return headers', async () => {
      app.get('/file.jpg', (req, res) => {
        res.send('welcome');
      });

      const res = await request(app).get('/file.jpg');
      expect(res.statusCode).toEqual(200);
      expect(res.headers['X-nonsense-1']).toBeUndefined();
      expect(res.headers['X-nonsense-2']).toBeUndefined();
    });
  });

  describe('publicPath option', () => {
    describe('should work with "string" value', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, { publicPath: '/public/' });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to the bundle file', (done) => {
        request(app).get('/public/bundle.js').expect(200, done);
      });
    });

    describe('should work with "auto" value', () => {
      beforeAll((done) => {
        const compiler = getCompiler(webpackConfig);

        instance = middleware(compiler, { publicPath: 'auto' });

        app = express();
        app.use(instance);

        listen = listenShorthand(done);
      });

      afterAll(close);

      it('should return the "200" code for the "GET" request to the bundle file', (done) => {
        request(app).get('/bundle.js').expect(200, done);
      });
    });
  });

  describe('serverSideRender option', () => {
    let locals;

    beforeAll((done) => {
      const compiler = getCompiler(webpackConfig);

      instance = middleware(compiler, { serverSideRender: true });

      app = express();
      app.use(instance);
      app.use((req, res) => {
        // eslint-disable-next-line prefer-destructuring
        locals = res.locals;

        res.sendStatus(200);
      });

      listen = listenShorthand(done);
    });

    afterAll(close);

    it('should return the "200" code for the "GET" request', (done) => {
      request(app)
        .get('/foo/bar')
        .expect(200, (error) => {
          if (error) {
            return done(error);
          }

          expect(locals.webpack.devMiddleware).toBeDefined();

          return done();
        });
    });
  });
});
