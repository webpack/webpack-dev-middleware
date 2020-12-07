import muteStdout from 'mute-stdout';
import express from 'express';
import connect from 'connect';
import webpack, { Stats } from 'webpack';

import middleware from '../src';

import getCompiler from './helpers/getCompiler';
import getCompilerHooks from './helpers/getCompilerHooks';
import webpackConfig from './fixtures/webpack.config';

muteStdout.mute();

describe.each([
  ['express', express],
  ['connect', connect],
])('%s framework:', (_, framework) => {
  describe('API', () => {
    let instance;
    let listen;
    let app;
    let compiler;

    describe('constructor', () => {
      describe('should accept compiler', () => {
        beforeEach((done) => {
          compiler = webpack(webpackConfig);

          instance = middleware(compiler);

          app = framework();
          app.use(instance);

          listen = app.listen((error) => {
            if (error) {
              return done(error);
            }

            return done();
          });
        });

        afterEach((done) => {
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
        });

        it('should work', (done) => {
          const doneSpy = jest.spyOn(
            (webpack.webpack
              ? getCompilerHooks(compiler).afterDone
              : getCompilerHooks(compiler).done)[0],
            'fn'
          );

          instance.waitUntilValid(() => {
            instance.close();

            expect(compiler.running).toBe(false);
            expect(doneSpy).toHaveBeenCalledTimes(1);

            doneSpy.mockRestore();

            done();
          });
        });
      });

      if (webpack.version[0] === 5) {
        describe('should accept compiler in watch mode', () => {
          beforeEach((done) => {
            compiler = webpack(
              { ...webpackConfig, ...{ watch: true } },
              (error) => {
                if (error) {
                  throw error;
                }
              }
            );

            instance = middleware(compiler);

            app = framework();
            app.use(instance);

            listen = app.listen((error) => {
              if (error) {
                return done(error);
              }

              return done();
            });
          });

          afterEach((done) => {
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
          });

          it('should work', (done) => {
            const doneSpy = jest.spyOn(
              (webpack.webpack
                ? getCompilerHooks(compiler).afterDone
                : getCompilerHooks(compiler).done)[0],
              'fn'
            );

            instance.waitUntilValid(() => {
              instance.close();

              expect(compiler.running).toBe(false);
              expect(doneSpy).toHaveBeenCalledTimes(1);

              doneSpy.mockRestore();

              done();
            });
          });
        });
      }
    });

    describe('waitUntilValid method', () => {
      beforeEach((done) => {
        compiler = getCompiler(webpackConfig);

        instance = middleware(compiler);

        app = framework();
        app.use(instance);

        listen = app.listen((error) => {
          if (error) {
            return done(error);
          }

          return done();
        });
      });

      afterEach((done) => {
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
      });

      it('should work without callback', (done) => {
        const doneSpy = jest.spyOn(
          (webpack.webpack
            ? getCompilerHooks(compiler).afterDone
            : getCompilerHooks(compiler).done)[0],
          'fn'
        );

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
        const doneSpy = jest.spyOn(
          (webpack.webpack
            ? getCompilerHooks(compiler).afterDone
            : getCompilerHooks(compiler).done)[0],
          'fn'
        );
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
        const doneSpy = jest.spyOn(
          (webpack.webpack
            ? getCompilerHooks(compiler).afterDone
            : getCompilerHooks(compiler).done)[0],
          'fn'
        );
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
      beforeEach((done) => {
        compiler = getCompiler(webpackConfig);

        instance = middleware(compiler);

        app = framework();
        app.use(instance);

        listen = app.listen((error) => {
          if (error) {
            return done(error);
          }

          return done();
        });
      });

      afterEach((done) => {
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
      });

      it('should work without callback', (done) => {
        const doneSpy = jest.spyOn(
          (webpack.webpack
            ? getCompilerHooks(compiler).afterDone
            : getCompilerHooks(compiler).done)[0],
          'fn'
        );

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
        const doneSpy = jest.spyOn(
          (webpack.webpack
            ? getCompilerHooks(compiler).afterDone
            : getCompilerHooks(compiler).done)[0],
          'fn'
        );
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
      beforeEach((done) => {
        compiler = getCompiler(webpackConfig);

        instance = middleware(compiler);

        app = framework();
        app.use(instance);

        listen = app.listen((error) => {
          if (error) {
            return done(error);
          }

          return done();
        });
      });

      afterEach((done) => {
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
      });

      it('should work without callback', (done) => {
        const doneSpy = jest.spyOn(
          (webpack.webpack
            ? getCompilerHooks(compiler).afterDone
            : getCompilerHooks(compiler).done)[0],
          'fn'
        );

        instance.waitUntilValid(() => {
          instance.close();

          expect(compiler.running).toBe(false);
          expect(doneSpy).toHaveBeenCalledTimes(1);

          doneSpy.mockRestore();

          done();
        });
      });

      it('should work with callback', (done) => {
        const doneSpy = jest.spyOn(
          (webpack.webpack
            ? getCompilerHooks(compiler).afterDone
            : getCompilerHooks(compiler).done)[0],
          'fn'
        );

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

    describe('context property', () => {
      beforeEach((done) => {
        compiler = getCompiler(webpackConfig);

        instance = middleware(compiler);

        app = framework();
        app.use(instance);

        listen = app.listen((error) => {
          if (error) {
            return done(error);
          }

          return done();
        });
      });

      afterEach((done) => {
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
      });

      it('should contain public properties', (done) => {
        expect(instance.context.state).toBeDefined();
        expect(instance.context.options).toBeDefined();
        expect(instance.context.compiler).toBeDefined();
        expect(instance.context.watching).toBeDefined();
        expect(instance.context.outputFileSystem).toBeDefined();

        // the compilation needs to finish, as it will still be running
        // after the test is done if not finished, potentially impacting other tests
        (webpack.webpack ? compiler.hooks.afterDone : compiler.hooks.done).tap(
          'wdm-test',
          () => {
            done();
          }
        );
      });
    });
  });
});
