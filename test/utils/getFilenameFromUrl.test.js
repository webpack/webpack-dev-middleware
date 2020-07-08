import path from 'path';

import express from 'express';

import middleware from '../../src';
import getFilenameFromUrl from '../../src/utils/getFilenameFromUrl';

import getCompiler from '../helpers/getCompiler';
import listenAndCompile from '../helpers/listenAndCompile';
import webpackSimpleConfig from '../fixtures/webpack.simple.config';
import webpackPublicPathConfig from '../fixtures/webpack.public-path.config';
import webpackMultiConfig from '../fixtures/webpack.array.config';

describe('getFilenameFromUrl', () => {
  const configs = [
    {
      title: 'simple config with path /',
      config: webpackSimpleConfig,
      middlewareConfig: {},
      url: '/',
      expected: path.resolve(__dirname, '../outputs/simple/index.html'),
    },
    {
      title: 'simple config with path /index.html',
      config: webpackSimpleConfig,
      middlewareConfig: {},
      url: '/index.html',
      expected: path.resolve(__dirname, '../outputs/simple/index.html'),
    },
    {
      title: 'simple config with path /path',
      config: webpackSimpleConfig,
      middlewareConfig: {},
      url: '/path',
      expected: path.resolve(__dirname, '../outputs/simple/path'),
    },
    {
      title: 'simple config with path /path/file.html',
      config: webpackSimpleConfig,
      middlewareConfig: {},
      url: '/path/file.html',
      expected: path.resolve(__dirname, '../outputs/simple/path/file.html'),
    },
    {
      title: 'simple config with index false and path /',
      config: webpackSimpleConfig,
      middlewareConfig: {
        index: false,
      },
      url: '/',
      expected: path.resolve(__dirname, '../outputs/simple'),
    },
    {
      title: 'simple config with index file.html and path /',
      config: webpackSimpleConfig,
      middlewareConfig: {
        index: 'file.html',
      },
      url: '/',
      expected: path.resolve(__dirname, '../outputs/simple/file.html'),
    },

    {
      title: 'publicPath config with path /',
      config: webpackPublicPathConfig,
      middlewareConfig: {},
      url: '/',
      expected: null,
    },
    {
      title: 'publicPath config with path /public/path/',
      config: webpackPublicPathConfig,
      middlewareConfig: {},
      url: '/public/path/',
      expected: path.resolve(__dirname, '../outputs/public-path/index.html'),
    },
    {
      title: 'publicPath config with path /public/path/more/file.html',
      config: webpackPublicPathConfig,
      middlewareConfig: {},
      url: '/public/path/more/file.html',
      expected: path.resolve(
        __dirname,
        '../outputs/public-path/more/file.html'
      ),
    },

    {
      title: 'multi config with path /',
      config: webpackMultiConfig,
      middlewareConfig: {},
      url: '/',
      expected: null,
    },
    {
      title: 'multi config with path /static-one/',
      config: webpackMultiConfig,
      middlewareConfig: {},
      url: '/static-one/',
      expected: path.resolve(__dirname, '../outputs/array/js1/index.html'),
    },
    {
      title: 'multi config with path /static-two/',
      config: webpackMultiConfig,
      middlewareConfig: {},
      url: '/static-two/',
      expected: path.resolve(__dirname, '../outputs/array/js2/index.html'),
    },
  ];

  configs.forEach((config) => {
    describe(config.title, () => {
      let instance;
      let listen;
      let app;
      let compiler;

      beforeEach((done) => {
        compiler = getCompiler(config.config);

        instance = middleware(compiler, config.middlewareConfig);

        app = express();
        app.use(instance);

        listen = listenAndCompile(app, compiler, done);
      });

      afterEach((done) => {
        if (instance) {
          instance.close();
        }

        if (listen) {
          listen.close(done);
        } else {
          done();
        }
      });

      it('should return correct filename from url', () => {
        console.log(instance.context.stats ? 'stats' : 'no stats');
        const filename = getFilenameFromUrl(instance.context, config.url);
        const { expected } = config;
        if (expected) {
          expect(filename).toEqual(expected);
        } else {
          expect(filename).toBeUndefined();
        }
      });
    });
  });
});
