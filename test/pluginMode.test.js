import middleware from "../src";

import webpackConfig from "./fixtures/webpack.config";
import getCompiler from "./helpers/getCompiler";

jest.spyOn(globalThis.console, "log").mockImplementation();

// When used as a plugin (`isPlugin = true`) the host (webpack-cli,
// webpack-dev-server, etc.) owns `compiler.watch()`, so the middleware has no
// `watching` of its own
describe("plugin mode", () => {
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
