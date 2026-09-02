import middleware from "../src";

import webpackArrayConfig from "./fixtures/webpack.array.config";
import webpackConfig from "./fixtures/webpack.config";
import getCompiler from "./helpers/getCompiler";

jest.spyOn(globalThis.console, "log").mockImplementation();

// When used as a plugin (`isPlugin = true`) the host (webpack-cli,
// webpack-dev-server, etc.) owns `compiler.watch()`, so the middleware has no
// `watching` of its own
describe("plugin mode", () => {
  describe("invalidate method", () => {
    it("should invalidate the watching owned by the host", (done) => {
      const compiler = getCompiler(webpackConfig);
      const watching = compiler.watch({}, () => {});
      const instance = middleware(compiler, {}, true);
      const invalidateSpy = jest.spyOn(watching, "invalidate");

      instance.waitUntilValid(() => {
        instance.invalidate();

        expect(invalidateSpy).toHaveBeenCalledTimes(1);

        watching.close(done);
      });
    });

    it("should call the callback after the host's rebuild finishes", (done) => {
      const compiler = getCompiler(webpackConfig);
      const watching = compiler.watch({}, () => {});
      const instance = middleware(compiler, {}, true);

      instance.waitUntilValid(() => {
        instance.invalidate(() => {
          expect(instance.context.state).toBe(true);

          watching.close(done);
        });
      });
    });

    it("should invalidate the host's watching for a MultiCompiler", (done) => {
      const compiler = getCompiler(webpackArrayConfig);
      const watching = compiler.watch({}, () => {});
      const instance = middleware(compiler, {}, true);
      const invalidateSpy = jest.spyOn(watching, "invalidate");
      const childSpies = compiler.compilers.map((childCompiler) =>
        jest.spyOn(childCompiler.watching, "invalidate"),
      );

      instance.waitUntilValid(() => {
        instance.invalidate();

        expect(invalidateSpy).toHaveBeenCalledTimes(1);
        // The `MultiCompiler`'s own watching propagates to every child, so
        // each is invalidated exactly once — the fallback loop must not run
        // as well and invalidate them a second time.
        for (const childSpy of childSpies) {
          expect(childSpy).toHaveBeenCalledTimes(1);
        }

        watching.close(done);
      });
    });

    it("should invalidate each child's watching when a MultiCompiler has none", (done) => {
      const compiler = getCompiler(webpackArrayConfig);
      const watching = compiler.watch({}, () => {});
      const instance = middleware(compiler, {}, true);
      const childSpies = compiler.compilers.map((childCompiler) =>
        jest.spyOn(childCompiler.watching, "invalidate"),
      );

      instance.waitUntilValid(() => {
        // `MultiCompiler` only exposes `watching` since webpack 5.109; on
        // older versions it lives on each child alone.
        const ownWatching = compiler.watching;

        compiler.watching = undefined;

        instance.invalidate();

        for (const childSpy of childSpies) {
          expect(childSpy).toHaveBeenCalledTimes(1);
        }

        compiler.watching = ownWatching;

        watching.close(done);
      });
    });

    it("should call the callback when there is nothing to invalidate", (done) => {
      const compiler = getCompiler(webpackConfig);
      const instance = middleware(compiler, {}, true);

      jest.spyOn(instance.context.logger, "warn").mockImplementation();

      // `close` completes its callback on the same no-op path. Without this,
      // `ready` queues the callback against a build that will never run.
      instance.invalidate((stats) => {
        // No build ran, so there are no stats to report.
        expect(stats).toBeUndefined();

        done();
      });
    });

    it("should warn when a MultiCompiler has no watching anywhere", () => {
      const compiler = getCompiler(webpackArrayConfig);
      const instance = middleware(compiler, {}, true);
      const warnSpy = jest
        .spyOn(instance.context.logger, "warn")
        .mockImplementation();

      expect(() => {
        instance.invalidate();
      }).not.toThrow();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("should not throw and warn when the host is not watching", () => {
      const compiler = getCompiler(webpackConfig);
      const instance = middleware(compiler, {}, true);
      const warnSpy = jest
        .spyOn(instance.context.logger, "warn")
        .mockImplementation();

      expect(() => {
        instance.invalidate();
      }).not.toThrow();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatchSnapshot("warning");
    });
  });

  describe("close method", () => {
    it("should not throw and call the callback when the host is not watching", (done) => {
      const compiler = getCompiler(webpackConfig);
      const instance = middleware(compiler, {}, true);
      const warnSpy = jest
        .spyOn(instance.context.logger, "warn")
        .mockImplementation();

      instance.close((error) => {
        expect(error).toBeNull();
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toMatchSnapshot("warning");

        done();
      });
    });

    it("should not close the watching owned by the host", (done) => {
      const compiler = getCompiler(webpackConfig);
      const watching = compiler.watch({}, () => {});
      const instance = middleware(compiler, {}, true);
      const warnSpy = jest
        .spyOn(instance.context.logger, "warn")
        .mockImplementation();

      instance.waitUntilValid(() => {
        instance.close((error) => {
          expect(error).toBeNull();
          expect(watching.closed).toBe(false);
          expect(warnSpy).toHaveBeenCalledTimes(1);
          expect(warnSpy.mock.calls[0][0]).toMatchSnapshot("warning");

          watching.close(done);
        });
      });
    });
  });
});
