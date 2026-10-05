import middleware from "../src";

import webpackConfig from "./fixtures/webpack.config";
import getCompiler from "./helpers/getCompiler";

jest.spyOn(globalThis.console, "log").mockImplementation();

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_OBJECT */

// The middleware hands `onConnect` and `handleUpgrade` through to the hot
// instance, and answers for itself when there is none — a server calling
// either with `hot` off should get a no-op, not a crash.
describe("the hot API on the middleware instance", () => {
  /** @type {EXPECTED_OBJECT[]} */
  let instances = [];

  afterEach((done) => {
    const closing = instances;

    instances = [];

    Promise.all(
      closing.map(
        (instance) =>
          new Promise((resolve) => {
            instance.close(resolve);
          }),
      ),
    ).then(() => done());
  });

  /**
   * Plugin mode, so the host owns the watching and none is started here.
   * @param {EXPECTED_OBJECT=} options middleware options
   * @returns {EXPECTED_OBJECT} the middleware instance
   */
  function build(options = {}) {
    const instance = middleware(getCompiler(webpackConfig), options, true);

    instances.push(instance);

    return instance;
  }

  describe("with hot enabled", () => {
    it("passes onConnect through to the endpoint", () => {
      const instance = build({ hot: true });
      const onConnect = jest.spyOn(instance.context.hot, "onConnect");
      const listener = () => {};

      instance.onConnect(listener);

      expect(onConnect).toHaveBeenCalledWith(listener);
    });

    it("passes handleUpgrade through and returns what it says", () => {
      const instance = build({ hot: true });
      const handleUpgrade = jest
        .spyOn(instance.context.hot, "handleUpgrade")
        .mockReturnValue(true);
      const req = {};
      const socket = {};
      const head = Buffer.alloc(0);

      expect(instance.handleUpgrade(req, socket, head)).toBe(true);
      expect(handleUpgrade).toHaveBeenCalledWith(req, socket, head);
    });

    it("says false for an upgrade the endpoint does not want", () => {
      const instance = build({ hot: true });

      jest.spyOn(instance.context.hot, "handleUpgrade").mockReturnValue(false);

      expect(instance.handleUpgrade({}, {}, Buffer.alloc(0))).toBe(false);
    });

    // What a server measures itself goes on the stream through here —
    // `ProgressPlugin` being the one the middleware used to apply for you.
    it("passes a payload of your own through to the endpoint", () => {
      const instance = build({ hot: true });
      const publish = jest.spyOn(instance.context.hot, "publish");
      const payload = { action: "progress", percent: 42, message: "building" };

      instance.publish(payload);

      expect(publish).toHaveBeenCalledWith(payload);
    });

    // A payload of someone else's carries whatever they measured, not a
    // subset this middleware approved. webpack-dev-server's progress plugin
    // reports which plugin a tick came from, and a `subscribe` handler is
    // what reads it — so the keys travel untouched rather than being typed
    // or filtered down to the ones the bundled client happens to render.
    it("does not pick over the keys of a payload of your own", () => {
      const instance = build({ hot: true });
      const publish = jest.spyOn(instance.context.hot, "publish");
      const payload = {
        action: "progress",
        percent: 42,
        message: "building",
        pluginName: "ProgressPlugin",
        anything: { nested: true },
      };

      instance.publish(payload);

      expect(publish).toHaveBeenCalledWith(payload);
    });
  });

  describe("with hot disabled", () => {
    it("has no upgrade to answer", () => {
      // Said rather than thrown: a server that owns `upgrade` can pass the
      // request on to whatever else it serves.
      expect(build().handleUpgrade({}, {}, Buffer.alloc(0))).toBe(false);
    });

    it("takes an onConnect listener and does nothing with it", () => {
      const instance = build();

      expect(() => instance.onConnect(() => {})).not.toThrow();
    });

    it("takes a payload and drops it, rather than making the caller ask", () => {
      const instance = build();

      expect(() => instance.publish({ action: "progress" })).not.toThrow();
    });
  });
});
