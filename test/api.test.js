import express from 'express';
import { Stats } from 'webpack';

import middleware from '../src';

import getCompiler from './helpers/getCompiler';
import getCompilerHooks from './helpers/getCompilerHooks';
import webpackConfig from './fixtures/server-test/webpack.config';

describe('API', () => {
  let instance;
  let listen;
  let app;
  let compiler;

  beforeEach((done) => {
    compiler = getCompiler(webpackConfig);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = app.listen((error) => {
      if (error) {
        return done(error);
      }

      return done();
    });
  });

  afterEach((done) => {
    instance.close();

    if (listen) {
      listen.close(done);
    } else {
      done();
    }
  });

  describe('waitUntilValid method', () => {
    it('should work without callback', (done) => {
      const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], 'fn');

      instance.waitUntilValid();

      const intervalId = setInterval(() => {
        if (instance.context.state) {
          expect(compiler.running).toBe(true);
          expect(instance.context.state).toBe(true);
          expect(doneSpy).toHaveBeenCalledTimes(1);
          expect(doneSpy.mock.calls[0][0]).toBeInstanceOf(Stats);

          doneSpy.mockRestore();

          clearInterval(intervalId);

          done();
        }
      });
    });

    it('should work with callback', (done) => {
      const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], 'fn');
      let callbackCounter = 0;

      instance.waitUntilValid(() => {
        callbackCounter += 1;
      });

      const intervalId = setInterval(() => {
        if (instance.context.state) {
          expect(compiler.running).toBe(true);
          expect(instance.context.state).toBe(true);
          expect(callbackCounter).toBe(1);
          expect(doneSpy).toHaveBeenCalledTimes(1);

          doneSpy.mockRestore();

          clearInterval(intervalId);

          done();
        }
      });
    });

    it('should run callback immediately when state already valid', (done) => {
      const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], 'fn');
      let callbackCounter = 0;
      let validToCheck = false;

      instance.waitUntilValid(() => {
        callbackCounter += 1;

        instance.waitUntilValid(() => {
          validToCheck = true;
          callbackCounter += 1;
        });
      });

      const intervalId = setInterval(() => {
        if (instance.context.state && validToCheck) {
          expect(compiler.running).toBe(true);
          expect(instance.context.state).toBe(true);
          expect(callbackCounter).toBe(2);
          expect(doneSpy).toHaveBeenCalledTimes(1);

          doneSpy.mockRestore();

          clearInterval(intervalId);

          done();
        }
      });
    });
  });

  describe('invalidate method', () => {
    it('should work without callback', (done) => {
      const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], 'fn');

      instance.invalidate();

      const intervalId = setInterval(() => {
        if (instance.context.state) {
          expect(compiler.running).toBe(true);
          expect(instance.context.state).toBe(true);
          expect(doneSpy).toHaveBeenCalledTimes(1);

          doneSpy.mockRestore();

          clearInterval(intervalId);

          done();
        }
      });
    });

    it('should work with callback', (done) => {
      const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], 'fn');
      let callbackCounter = 0;

      instance.invalidate(() => {
        callbackCounter += 1;
      });

      const intervalId = setInterval(() => {
        if (instance.context.state) {
          expect(compiler.running).toBe(true);
          expect(instance.context.state).toBe(true);
          expect(callbackCounter).toBe(1);
          expect(doneSpy).toHaveBeenCalledTimes(1);

          doneSpy.mockRestore();

          clearInterval(intervalId);

          done();
        }
      });
    });
  });

  describe('close method', () => {
    it('should work without callback', (done) => {
      const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], 'fn');

      instance.waitUntilValid(() => {
        instance.close();

        expect(compiler.running).toBe(false);
        expect(doneSpy).toHaveBeenCalledTimes(1);

        doneSpy.mockRestore();

        done();
      });
    });

    it('should work with callback', (done) => {
      const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], 'fn');

      instance.waitUntilValid(() => {
        instance.close(() => {
          expect(compiler.running).toBe(false);
          expect(doneSpy).toHaveBeenCalledTimes(1);

          doneSpy.mockRestore();

          done();
        });
      });
    });
  });

  describe('getFilenameFromUrl method', () => {
    it('use publicPath and compiler.outputPath to parse the filename', () => {
      const filename = instance.getFilenameFromUrl('/public/index.html');

      expect(filename.endsWith('/public/index.html')).toBe(true);
    });
  });

  describe('context property', () => {
    it('should contain public properties', () => {
      expect(instance.context.state).toBeDefined();
      expect(instance.context.options).toBeDefined();
      expect(instance.context.compiler).toBeDefined();
      expect(instance.context.watching).toBeDefined();
      expect(instance.context.outputFileSystem).toBeDefined();
    });
  });
});
