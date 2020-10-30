import express from 'express';

import request from 'supertest';

import middleware from '../../src';
import getCompiler from '../helpers/getCompiler';
import GetLogsPlugin from '.././helpers/GetLogsPlugin';

import webpackConfig from '.././fixtures/webpack.config';
import webpackMultiWarningConfig from '.././fixtures/webpack.array.warning.config';
import webpackOneErrorOneWarningOneSuccessConfig from '.././fixtures/webpack.array.one-error-one-warning-one-success';
import webpackOneErrorOneWarningOneSuccessWithNamesConfig from '.././fixtures/webpack.array.one-error-one-warning-one-success-with-names';

describe('should respect the "stats" option with the "false" value from the configuration', () => {
  let compiler;
  let getLogsPlugin;
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
    compiler = getCompiler({ ...webpackConfig, stats: false });

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to the bundle file', (done) => {
    request(app)
      .get('/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        expect(getLogsPlugin.logs).toMatchSnapshot();

        return done();
      });
  });
});

describe('should respect the "stats" option with the "none" value from the configuration', () => {
  let compiler;
  let getLogsPlugin;
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
    compiler = getCompiler({ ...webpackConfig, stats: 'none' });

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to the bundle file', (done) => {
    request(app)
      .get('/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        expect(getLogsPlugin.logs).toMatchSnapshot();

        return done();
      });
  });
});

describe('should respect the "stats" option with the "minimal" value from the configuration', () => {
  let compiler;
  let getLogsPlugin;
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
    compiler = getCompiler({ ...webpackConfig, stats: 'minimal' });

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to the bundle file', (done) => {
    request(app)
      .get('/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        expect(getLogsPlugin.logs).toMatchSnapshot();

        return done();
      });
  });
});

describe('should respect the "stats" option in multi-compiler mode', () => {
  let compiler;
  let getLogsPlugin;
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
    compiler = getCompiler(webpackOneErrorOneWarningOneSuccessConfig);

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return the "200" code for the "GET" requests to bundles file', (done) => {
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

            return request(app)
              .get('/static-three/bundle.js')
              .expect(200, (thirdError) => {
                if (thirdError) {
                  return done(thirdError);
                }

                expect(getLogsPlugin.logs).toMatchSnapshot();

                return done();
              });
          });
      });
  });
});

describe('should respect the "stats" option with the "{ all: false, entrypoints: true }" value from the configuration', () => {
  let compiler;
  let getLogsPlugin;
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
      stats: { all: false, entrypoints: true },
    });

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to the bundle file', (done) => {
    request(app)
      .get('/bundle.js')
      .expect(200, (error) => {
        if (error) {
          return done(error);
        }

        expect(getLogsPlugin.logs).toMatchSnapshot();

        return done();
      });
  });
});

describe('should respect the "stats" option from the configuration in multi-compiler mode', () => {
  let compiler;
  let getLogsPlugin;
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
    compiler = getCompiler(webpackMultiWarningConfig);

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return the "200" code for the "GET" request to bundle files', (done) => {
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

            expect(getLogsPlugin.logs).toMatchSnapshot();

            return done();
          });
      });
  });
});

describe('should respect the "stats" option from the configuration in multi-compiler mode and use the "name" option', () => {
  let compiler;
  let getLogsPlugin;
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
    compiler = getCompiler(webpackOneErrorOneWarningOneSuccessWithNamesConfig);

    getLogsPlugin = new GetLogsPlugin();
    getLogsPlugin.apply(compiler);

    instance = middleware(compiler);

    app = express();
    app.use(instance);

    listen = listenShorthand(done);
  });

  afterAll(close);

  it('should return the "200" code for "GET" requests to bundle files', (done) => {
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

            return request(app)
              .get('/static-three/bundle.js')
              .expect(200, (thirdError) => {
                if (thirdError) {
                  return done(thirdError);
                }

                expect(getLogsPlugin.logs).toMatchSnapshot();

                return done();
              });
          });
      });
  });
});
