import { log, setLogLevel, setLogName } from "../client-src/utils/log.js";

/**
 * Replace the console methods the logger writes to, and hand back what each was
 * called with.
 * @returns {Record<string, jest.SpyInstance>} the spies, by method
 */
function spyOnConsole() {
  /** @type {Record<string, jest.SpyInstance>} */
  const spies = {};

  for (const method of [
    "error",
    "warn",
    "info",
    "log",
    "group",
    "groupCollapsed",
    "groupEnd",
  ]) {
    spies[method] = jest
      .spyOn(
        /** @type {Record<string, (...args: unknown[]) => void>} */ (
          /** @type {unknown} */ (console)
        ),
        method,
      )
      .mockImplementation(() => {});
  }

  return spies;
}

describe("the client's console logger", () => {
  /** @type {Record<string, jest.SpyInstance>} */
  let spies;

  beforeEach(() => {
    spies = spyOnConsole();
    setLogLevel("info");
    setLogName();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("labels a message with the logger's name", () => {
    log.info("connected");

    expect(spies.info).toHaveBeenCalledWith(
      "[webpack-dev-middleware] connected",
    );
  });

  it("labels what is not a string without joining it to one", () => {
    const value = { a: 1 };

    log.error(value, "and more");

    expect(spies.error).toHaveBeenCalledWith(
      "[webpack-dev-middleware]",
      value,
      "and more",
    );
  });

  it("keeps the arguments after the message as they were", () => {
    log.warn("trouble", 1, "two");

    expect(spies.warn).toHaveBeenCalledWith(
      "[webpack-dev-middleware] trouble",
      1,
      "two",
    );
  });

  it("says the name it was given", () => {
    setLogName("my-server");
    log.info("connected");

    expect(spies.info).toHaveBeenCalledWith("[my-server] connected");

    setLogName();
    log.info("connected");

    expect(spies.info).toHaveBeenLastCalledWith(
      "[webpack-dev-middleware] connected",
    );
  });

  describe("levels", () => {
    // What each level lets through, which is webpack's own table: a level
    // shows what is as severe as it, and everything more so.
    const cases = [
      ["none", []],
      [false, []],
      ["error", ["error"]],
      ["warn", ["error", "warn"]],
      ["info", ["error", "warn", "info"]],
      ["log", ["error", "warn", "info", "log"]],
      [true, ["error", "warn", "info", "log"]],
      ["verbose", ["error", "warn", "info", "log"]],
    ];

    it.each(cases)("%j shows %j", (level, shown) => {
      setLogLevel(level);

      for (const method of ["error", "warn", "info", "log"]) {
        log[method]("message");
      }

      for (const method of ["error", "warn", "info", "log"]) {
        expect(spies[method]).toHaveBeenCalledTimes(
          shown.includes(method) ? 1 : 0,
        );
      }
    });

    it("shows everything for a level it does not know", () => {
      setLogLevel(/** @type {EXPECTED_ANY} */ ("nonsense"));
      log.log("message");

      expect(spies.log).toHaveBeenCalledTimes(1);
    });
  });

  describe("groups", () => {
    it("opens one collapsed, and closes it", () => {
      setLogLevel("log");
      log.groupCollapsed("title");
      log.groupEnd();

      expect(spies.groupCollapsed).toHaveBeenCalledWith(
        "[webpack-dev-middleware] title",
      );
      expect(spies.groupEnd).toHaveBeenCalledTimes(1);
    });

    it("opens one that is not collapsed at verbose", () => {
      setLogLevel("verbose");
      log.groupCollapsed("title");

      expect(spies.group).toHaveBeenCalledWith(
        "[webpack-dev-middleware] title",
      );
      expect(spies.groupCollapsed).not.toHaveBeenCalled();
    });

    it("says nothing below the level that shows them", () => {
      setLogLevel("info");
      log.groupCollapsed("title");
      log.groupEnd();

      expect(spies.groupCollapsed).not.toHaveBeenCalled();
      expect(spies.group).not.toHaveBeenCalled();
      expect(spies.groupEnd).not.toHaveBeenCalled();
    });

    it("falls back to a plain line where the console cannot group", () => {
      setLogLevel("log");

      const { groupCollapsed, group, groupEnd } = console;

      // @ts-expect-error -- a console without grouping, as a minimal one is
      console.groupCollapsed = undefined;
      // @ts-expect-error -- ditto
      console.group = undefined;
      // @ts-expect-error -- ditto
      console.groupEnd = undefined;

      try {
        log.groupCollapsed("title");
        log.groupEnd();

        expect(spies.log).toHaveBeenCalledWith(
          "[webpack-dev-middleware] title",
        );
      } finally {
        console.groupCollapsed = groupCollapsed;
        console.group = group;
        console.groupEnd = groupEnd;
      }
    });
  });
});
