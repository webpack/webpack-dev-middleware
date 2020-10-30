import path from 'path';
import fs from 'fs';

import express from 'express';

import memfs, { createFsFromVolume, Volume } from 'memfs';

import middleware from '../../src';

import getCompiler from '../helpers/getCompiler';

import webpackConfig from '.././fixtures/webpack.config';
import webpackMultiConfig from '.././fixtures/webpack.array.config';

describe('should work with the configured value (native fs)', () => {
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

    const configuredFs = fs;

    configuredFs.join = path.join.bind(path);
    configuredFs.mkdirp = () => {};

    instance = middleware(compiler, {
      outputFileSystem: configuredFs,
    });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should use the configurated output filesystem', () => {
    const { Stats } = fs;

    expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
    expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(Stats);
    expect(compiler.outputFileSystem).toHaveProperty('join');
    expect(compiler.outputFileSystem).toHaveProperty('mkdirp');
  });
});
describe('should work with the configured value (memfs)', () => {
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

    const configuredFs = createFsFromVolume(new Volume());

    configuredFs.join = path.join.bind(path);

    instance = middleware(compiler, {
      outputFileSystem: configuredFs,
    });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should use the configured output filesystem', () => {
    const { Stats } = memfs;

    expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
    expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(Stats);
    expect(compiler.outputFileSystem).toHaveProperty('join');
    expect(compiler.outputFileSystem).toHaveProperty('mkdirp');
  });
});
describe('should work with the configured value in multi-compiler mode (native fs)', () => {
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
    compiler = getCompiler(webpackMultiConfig);

    const configuredFs = fs;

    configuredFs.join = path.join.bind(path);
    configuredFs.mkdirp = () => {};

    instance = middleware(compiler, {
      outputFileSystem: configuredFs,
    });

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should use configured output filesystems', () => {
    const { Stats } = fs;

    for (const childCompiler of compiler.compilers) {
      expect(new childCompiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
      expect(childCompiler.outputFileSystem).toHaveProperty('join');
      expect(childCompiler.outputFileSystem).toHaveProperty('mkdirp');
    }

    expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(Stats);
    expect(instance.context.outputFileSystem).toHaveProperty('join');
    expect(instance.context.outputFileSystem).toHaveProperty('mkdirp');
  });
});
