import path from "path";

import express from "express";
import connect from "connect";
import webpack, { Stats } from "webpack";

import middleware from "../src";

import getCompiler from "./helpers/getCompiler";
import getCompilerHooks from "./helpers/getCompilerHooks";
import webpackConfig from "./fixtures/webpack.config";
import webpackPublicPathConfig from "./fixtures/webpack.public-path.config";
import webpackMultiConfig from "./fixtures/webpack.array.config";

// Suppress unnecessary stats output
global.console.log = jest.fn();

describe.each([
  ["express", express],
  ["connect", connect],
])("%s framework:", (_, framework) => {
  describe("API", () => {
    let instance;
    let listen;
    let app;
    let compiler;

    describe("constructor", () => {
      describe("should accept compiler", () => {
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

        it("should work", (done) => {
          const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], "fn");

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
        describe("should accept compiler in watch mode", () => {
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

          it("should work", (done) => {
            const doneSpy = jest.spyOn(
              getCompilerHooks(compiler).done[0],
              "fn"
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

    describe("waitUntilValid method", () => {
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

      it("should work without callback", (done) => {
        const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], "fn");

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

      it("should work with callback", (done) => {
        const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], "fn");
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

      it("should run callback immediately when state already valid", (done) => {
        const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], "fn");
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

    describe("invalidate method", () => {
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

      it("should work without callback", (done) => {
        const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], "fn");

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

      it("should work with callback", (done) => {
        const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], "fn");
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

    describe("getFilenameFromUrl method", () => {
      describe("should work", () => {
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

        it("should work", (done) => {
          instance.waitUntilValid(() => {
            expect(instance.getFilenameFromUrl("/bundle.js")).toBe(
              path.join(webpackConfig.output.path, "/bundle.js")
            );
            expect(instance.getFilenameFromUrl("/")).toBe(
              path.join(webpackConfig.output.path, "/index.html")
            );
            expect(instance.getFilenameFromUrl("/index.html")).toBe(
              path.join(webpackConfig.output.path, "/index.html")
            );
            expect(instance.getFilenameFromUrl("/svg.svg")).toBe(
              path.join(webpackConfig.output.path, "/svg.svg")
            );
            expect(
              instance.getFilenameFromUrl("/unknown.unknown")
            ).toBeUndefined();
            expect(
              instance.getFilenameFromUrl("/unknown/unknown.unknown")
            ).toBeUndefined();

            done();
          });
        });
      });

      describe('should work when the "index" option disabled', () => {
        beforeEach((done) => {
          compiler = getCompiler(webpackConfig);

          instance = middleware(compiler, { index: false });

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

        it("should work", (done) => {
          instance.waitUntilValid(() => {
            expect(instance.getFilenameFromUrl("/bundle.js")).toBe(
              path.join(webpackConfig.output.path, "/bundle.js")
            );
            // eslint-disable-next-line no-undefined
            expect(instance.getFilenameFromUrl("/")).toBe(undefined);
            expect(instance.getFilenameFromUrl("/index.html")).toBe(
              path.join(webpackConfig.output.path, "/index.html")
            );
            expect(instance.getFilenameFromUrl("/svg.svg")).toBe(
              path.join(webpackConfig.output.path, "/svg.svg")
            );
            expect(
              instance.getFilenameFromUrl("/unknown.unknown")
            ).toBeUndefined();
            expect(
              instance.getFilenameFromUrl("/unknown/unknown.unknown")
            ).toBeUndefined();

            done();
          });
        });
      });

      describe('should work with the "publicPath" option', () => {
        beforeEach((done) => {
          compiler = getCompiler(webpackPublicPathConfig);

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

        it("should work", (done) => {
          instance.waitUntilValid(() => {
            expect(instance.getFilenameFromUrl("/public/path/bundle.js")).toBe(
              path.join(webpackPublicPathConfig.output.path, "/bundle.js")
            );
            expect(instance.getFilenameFromUrl("/public/path/")).toBe(
              path.join(webpackPublicPathConfig.output.path, "/index.html")
            );
            expect(instance.getFilenameFromUrl("/public/path/index.html")).toBe(
              path.join(webpackPublicPathConfig.output.path, "/index.html")
            );
            expect(instance.getFilenameFromUrl("/public/path/svg.svg")).toBe(
              path.join(webpackPublicPathConfig.output.path, "/svg.svg")
            );

            expect(instance.getFilenameFromUrl("/")).toBeUndefined();
            expect(
              instance.getFilenameFromUrl("/unknown.unknown")
            ).toBeUndefined();
            expect(
              instance.getFilenameFromUrl("/unknown/unknown.unknown")
            ).toBeUndefined();

            done();
          });
        });
      });

      describe("should work in multi compiler mode", () => {
        beforeEach((done) => {
          compiler = getCompiler(webpackMultiConfig);

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

        it("should work", (done) => {
          instance.waitUntilValid(() => {
            expect(instance.getFilenameFromUrl("/static-one/bundle.js")).toBe(
              path.join(webpackMultiConfig[0].output.path, "/bundle.js")
            );
            expect(instance.getFilenameFromUrl("/static-one/")).toBe(
              path.join(webpackMultiConfig[0].output.path, "/index.html")
            );
            expect(instance.getFilenameFromUrl("/static-one/index.html")).toBe(
              path.join(webpackMultiConfig[0].output.path, "/index.html")
            );
            expect(instance.getFilenameFromUrl("/static-one/svg.svg")).toBe(
              path.join(webpackMultiConfig[0].output.path, "/svg.svg")
            );
            expect(
              instance.getFilenameFromUrl("/static-one/unknown.unknown")
            ).toBeUndefined();
            expect(
              instance.getFilenameFromUrl("/static-one/unknown/unknown.unknown")
            ).toBeUndefined();

            expect(instance.getFilenameFromUrl("/static-two/bundle.js")).toBe(
              path.join(webpackMultiConfig[1].output.path, "/bundle.js")
            );
            expect(
              instance.getFilenameFromUrl("/static-two/unknown.unknown")
            ).toBeUndefined();
            expect(
              instance.getFilenameFromUrl("/static-two/unknown/unknown.unknown")
            ).toBeUndefined();

            expect(instance.getFilenameFromUrl("/")).toBeUndefined();
            expect(
              instance.getFilenameFromUrl("/static-one/unknown.unknown")
            ).toBeUndefined();
            expect(
              instance.getFilenameFromUrl("/static-one/unknown/unknown.unknown")
            ).toBeUndefined();

            done();
          });
        });
      });
    });

    describe("close method", () => {
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

      it("should work without callback", (done) => {
        const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], "fn");

        instance.waitUntilValid(() => {
          instance.close();

          expect(compiler.running).toBe(false);
          expect(doneSpy).toHaveBeenCalledTimes(1);

          doneSpy.mockRestore();

          done();
        });
      });

      it("should work with callback", (done) => {
        const doneSpy = jest.spyOn(getCompilerHooks(compiler).done[0], "fn");

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

    describe("context property", () => {
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

      it("should contain public properties", (done) => {
        expect(instance.context.state).toBeDefined();
        expect(instance.context.options).toBeDefined();
        expect(instance.context.compiler).toBeDefined();
        expect(instance.context.watching).toBeDefined();
        expect(instance.context.outputFileSystem).toBeDefined();

        // the compilation needs to finish, as it will still be running
        // after the test is done if not finished, potentially impacting other tests
        compiler.hooks.done.tap("wdm-test", () => {
          done();
        });
      });
    });
  });
});
