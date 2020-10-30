import path from 'path';

import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';

import webpackConfig from '../fixtures/webpack.config';
import isWebpack5 from '../helpers/isWebpack5';
import webpackMultiConfig from '../fixtures/webpack.array.config';

import webpackClientServerConfig from '../fixtures/webpack.client.server.config';

describe('should respect empty "output.publicPath" and "output.path" options', () => {
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
    const compiler = getCompiler(webpackConfig);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file', (done) => {
    request(app).get('/bundle.js').expect(200, done);
  });

  it('should return "404" code for GET request to a nonexistent file', (done) => {
    request(app).get('/invalid.js').expect(404, done);
  });

  it('should return "200" code for GET request to the non-public path', (done) => {
    request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the "index" option', (done) => {
    request(app)
      .get('/index.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });
});

describe('should respect "output.publicPath" and "output.path" options', () => {
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
    const compiler = getCompiler({
      ...webpackConfig,
      output: {
        filename: 'bundle.js',
        publicPath: '/static/',
        path: path.resolve(__dirname, './outputs/other-basic'),
      },
    });

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file', (done) => {
    request(app).get('/static/bundle.js').expect(200, done);
  });

  it('should return "404" code for GET request to a nonexistent file', (done) => {
    request(app).get('/static/invalid.js').expect(404, done);
  });

  it('should return "200" code for GET request to the public path', (done) => {
    request(app)
      .get('/static/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the "index" option', (done) => {
    request(app)
      .get('/static/index.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "404" code for GET request to the non-public path', (done) => {
    request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(404, done);
  });
});

describe('should respect "output.publicPath" and "output.path" options with hash substitutions', () => {
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
    const compiler = getCompiler({
      ...webpackConfig,
      output: {
        filename: 'bundle.js',
        publicPath: isWebpack5() ? '/static/[fullhash]/' : '/static/[hash]/',
        path: isWebpack5()
          ? path.resolve(__dirname, './outputs/other-basic-[fullhash]')
          : path.resolve(__dirname, './outputs/other-basic-[hash]'),
      },
    });

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(() => {
      compiler.hooks.afterCompile.tap('wdm-test', ({ hash: h }) => {
        hash = h;
        done();
      });
    });
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file', (done) => {
    request(app).get(`/static/${hash}/bundle.js`).expect(200, done);
  });

  it('should return "404" code for GET request to a nonexistent file', (done) => {
    request(app).get('/static/invalid.js').expect(404, done);
  });

  it('should return "200" code for GET request to the public path', (done) => {
    request(app)
      .get(`/static/${hash}/`)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the "index" option', (done) => {
    request(app)
      .get(`/static/${hash}/index.html`)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "404" code for GET request to the non-public path', (done) => {
    request(app).get('/').expect(404, done);
  });
});

describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode with hash substitutions', () => {
  let hashOne;
  let hashTwo;
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
    const compiler = getCompiler([
      {
        ...webpackMultiConfig[0],
        output: {
          filename: 'bundle.js',
          path: isWebpack5()
            ? path.resolve(__dirname, './outputs/array-[fullhash]/static-one')
            : path.resolve(__dirname, './outputs/array-[hash]/static-one'),
          publicPath: isWebpack5()
            ? '/static-one/[fullhash]/'
            : '/static-one/[hash]/',
        },
      },
      {
        ...webpackMultiConfig[1],
        output: {
          filename: 'bundle.js',
          path: isWebpack5()
            ? path.resolve(__dirname, './outputs/array-[fullhash]/static-two')
            : path.resolve(__dirname, './outputs/array-[hash]/static-two'),
          publicPath: isWebpack5()
            ? '/static-two/[fullhash]/'
            : '/static-two/[hash]/',
        },
      },
    ]);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(() => {
      compiler.hooks.done.tap('wdm-test', (params) => {
        const [one, two] = params.stats;

        hashOne = one.hash;
        hashTwo = two.hash;

        done();
      });
    });
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file for the first compiler', (done) => {
    request(app).get(`/static-one/${hashOne}/bundle.js`).expect(200, done);
  });

  it('should return "404" code for GET request to nonexistent file for the first compiler', (done) => {
    request(app).get(`/static-one/${hashOne}/invalid.js`).expect(404, done);
  });

  it('should return "200" code for GET request for the second bundle file', (done) => {
    request(app)
      .get(`/static-one/${hashOne}/`)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the "index" option for the first compiler', (done) => {
    request(app)
      .get(`/static-one/${hashOne}/index.html`)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the bundle file for the second compiler', (done) => {
    request(app).get(`/static-two/${hashTwo}/bundle.js`).expect(200, done);
  });

  it('should return "404" code for GET request to nonexistent file for the second compiler', (done) => {
    request(app).get(`/static-two/${hashTwo}/invalid.js`).expect(404, done);
  });

  it('should return "404" code for GET request to the "public" path for the second compiler', (done) => {
    request(app).get(`/static-two/${hashTwo}/`).expect(404, done);
  });

  it('should return "404" code for GET request to the "index" option for the second compiler', (done) => {
    request(app).get(`/static-two/${hashTwo}/index.html`).expect(404, done);
  });

  it('should return "404" code for GET request to non-public path', (done) => {
    request(app).get('/').expect(404, done);
  });
});

describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode with difference "publicPath" and "path"', () => {
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
    const compiler = getCompiler(webpackMultiConfig);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file for the first compiler', (done) => {
    request(app).get('/static-one/bundle.js').expect(200, done);
  });

  it('should return "404" code for GET request to nonexistent file for the first compiler', (done) => {
    request(app).get('/static-one/invalid.js').expect(404, done);
  });

  it('should return "200" code for GET request to the "public" path for the first compiler', (done) => {
    request(app)
      .get('/static-one/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the "index" option for the first compiler', (done) => {
    request(app)
      .get('/static-one/index.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the second bundle file', (done) => {
    request(app).get('/static-two/bundle.js').expect(200, done);
  });

  it('should return "404" code for GET request to nonexistent file for the second compiler', (done) => {
    request(app).get('/static-two/invalid.js').expect(404, done);
  });

  it('should return "200" code for GET request to the "public" path for the second compiler', (done) => {
    request(app).get('/static-two/').expect(404, done);
  });

  it('should return "200" code for GET request to the "index" option for the second compiler', (done) => {
    request(app).get('/static-two/index.html').expect(404, done);
  });

  it('should return "404" code for GET request to nonexistent file', (done) => {
    request(app).get('/static/invalid.js').expect(404, done);
  });

  it('should return "404" code for GET request to non-public path', (done) => {
    request(app).get('/').expect(404, done);
  });
});

describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode with same "publicPath"', () => {
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
    const compiler = getCompiler([
      {
        ...webpackMultiConfig[0],
        output: {
          filename: 'bundle-one.js',
          path: path.resolve(__dirname, './outputs/array/static-one'),
          publicPath: '/my-public/',
        },
      },
      {
        ...webpackMultiConfig[1],
        output: {
          filename: 'bundle-two.js',
          path: path.resolve(__dirname, './outputs/array/static-two'),
          publicPath: '/my-public/',
        },
      },
    ]);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file for the first compiler', (done) => {
    request(app).get('/my-public/bundle-one.js').expect(200, done);
  });

  it('should return "200" code for GET request to the bundle file for the second compiler', (done) => {
    request(app).get('/my-public/bundle-two.js').expect(200, done);
  });

  it('should return "404" code for GET request to nonexistent file', (done) => {
    request(app).get('/my-public/invalid.js').expect(404, done);
  });

  it('should return "200" code for GET request to the "public" path', (done) => {
    request(app)
      .get('/my-public/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the "index" option', (done) => {
    request(app)
      .get('/my-public/index.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "404" code for GET request to nonexistent file', (done) => {
    request(app).get('/static/invalid.js').expect(404, done);
  });

  it('should return "404" code for GET request to non-public path', (done) => {
    request(app).get('/').expect(404, done);
  });
});

describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode with same "path"', () => {
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
    const compiler = getCompiler([
      {
        ...webpackMultiConfig[0],
        output: {
          filename: 'bundle-one.js',
          path: path.resolve(__dirname, './outputs/array/static-one'),
          publicPath: '/one-public/',
        },
      },
      {
        ...webpackMultiConfig[1],
        output: {
          filename: 'bundle-two.js',
          path: path.resolve(__dirname, './outputs/array/static-one'),
          publicPath: '/two-public/',
        },
      },
    ]);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file for the first compiler', (done) => {
    request(app).get('/one-public/bundle-one.js').expect(200, done);
  });

  it('should return "404" code for GET request to nonexistent file to the first bundle file', (done) => {
    request(app).get('/one-public/invalid.js').expect(404, done);
  });

  it('should return "200" code for GET request to the "public" path for the first compiler', (done) => {
    request(app)
      .get('/one-public/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the "index" option for the first compiler', (done) => {
    request(app)
      .get('/one-public/index.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the bundle file for the second compiler', (done) => {
    request(app).get('/two-public/bundle-two.js').expect(200, done);
  });

  it('should return "404" code for GET request to nonexistent file to the second bundle file', (done) => {
    request(app).get('/two-public/invalid.js').expect(404, done);
  });

  it('should return "200" code for GET request to the "public" path for the second compiler', (done) => {
    request(app)
      .get('/two-public/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "200" code for GET request to the "index" option for the second compiler', (done) => {
    request(app)
      .get('/two-public/index.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "404" code for GET request to nonexistent file', (done) => {
    request(app).get('/static/invalid.js').expect(404, done);
  });

  it('should return "404" code for GET request to non-public path', (done) => {
    request(app).get('/').expect(404, done);
  });
});

describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode, when the "output.publicPath" option presented in only one configuration (in first)', () => {
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
    const compiler = getCompiler(webpackClientServerConfig);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file', (done) => {
    request(app).get('/static/bundle.js').expect(200, done);
  });

  it('should return "404" code for GET request to nonexistent file', (done) => {
    request(app).get('/static/invalid.js').expect(404, done);
  });

  it('should return "404" code for GET request to the public path', (done) => {
    request(app)
      .get('/static/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "404" code for GET request to the "index" option', (done) => {
    request(app)
      .get('/static/index.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "404" code for GET request to non-public path', (done) => {
    request(app).get('/').expect(404, done);
  });
});

describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode, when the "output.publicPath" option presented in only one configuration (in second)', () => {
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
    const compiler = getCompiler([
      webpackClientServerConfig[1],
      webpackClientServerConfig[0],
    ]);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file', (done) => {
    request(app).get('/static/bundle.js').expect(200, done);
  });

  it('should return "404" code for GET request to nonexistent file', (done) => {
    request(app).get('/static/invalid.js').expect(404, done);
  });

  it('should return "404" code for GET request to the public path', (done) => {
    request(app)
      .get('/static/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "404" code for GET request to the "index" option', (done) => {
    request(app)
      .get('/static/index.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "404" code for GET request to non-public path', (done) => {
    request(app).get('/').expect(404, done);
  });
});

describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode, when the "output.publicPath" option presented in only one configuration with same "path"', () => {
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
    const compiler = getCompiler([
      {
        ...webpackClientServerConfig[0],
        output: {
          filename: 'bundle-one.js',
          path: path.resolve(__dirname, './outputs/client-server/same'),
          publicPath: '/static/',
        },
      },
      {
        ...webpackClientServerConfig[1],
        output: {
          filename: 'bundle-two.js',
          path: path.resolve(__dirname, './outputs/client-server/same'),
        },
      },
    ]);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return "200" code for GET request to the bundle file', (done) => {
    request(app).get('/static/bundle-one.js').expect(200, done);
  });

  it('should return "404" code for GET request to a nonexistent file', (done) => {
    request(app).get('/static/invalid.js').expect(404, done);
  });

  it('should return "404" code for GET request to the public path', (done) => {
    request(app).get('/static/').expect(200, done);
  });

  it('should return "200" code for GET request to the non-public path', (done) => {
    request(app)
      .get('/')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });

  it('should return "404" code for GET request to the "index" option', (done) => {
    request(app)
      .get('/static/index.html')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200, done);
  });
});
