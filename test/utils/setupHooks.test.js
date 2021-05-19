import setupHooks from "../../src/utils/setupHooks";

// Suppress unnecessary stats output
global.console.log = jest.fn();

describe("setupHooks", () => {
  let context;
  const watchRunHook = jest.fn();
  const invalidHook = jest.fn();
  const doneHook = jest.fn();
  const loggerLog = jest.fn();
  const loggerInfo = jest.fn();
  const loggerWarn = jest.fn();
  const loggerError = jest.fn();
  let nextTick;

  const cb1 = jest.fn();
  const cb2 = jest.fn();

  beforeEach(() => {
    nextTick = jest.spyOn(process, "nextTick").mockImplementation(() => {});
    context = {
      options: {},
      compiler: {
        hooks: {
          watchRun: {
            tap: watchRunHook,
          },
          invalid: {
            tap: invalidHook,
          },
          done: {
            tap: doneHook,
          },
        },
        options: { stats: {} },
      },
      logger: {
        log: loggerLog,
        info: loggerInfo,
        warn: loggerWarn,
        error: loggerError,
      },
      callbacks: [cb1, cb2],
    };
  });

  afterEach(() => {
    watchRunHook.mockClear();
    invalidHook.mockClear();
    doneHook.mockClear();
    loggerInfo.mockClear();
    loggerWarn.mockClear();
    loggerError.mockClear();
    nextTick.mockClear();
    cb1.mockClear();
    cb2.mockClear();
  });

  it("taps watchRun, invalid, and done", () => {
    setupHooks(context);
    expect(watchRunHook.mock.calls.length).toEqual(1);
    expect(invalidHook.mock.calls.length).toEqual(1);
    expect(doneHook.mock.calls.length).toEqual(1);
  });

  it("watchRun hook invalidates", () => {
    setupHooks(context);
    // this calls invalidate
    watchRunHook.mock.calls[0][1]();
    expect(context.state).toEqual(false);
    expect(context.stats).toBeUndefined();
    expect(loggerInfo.mock.calls.length).toEqual(0);
  });

  it("invalid hook invalidates", () => {
    setupHooks(context);
    // this calls invalidate
    invalidHook.mock.calls[0][1]();
    expect(context.state).toEqual(false);
    expect(context.stats).toBeUndefined();
    expect(loggerInfo.mock.calls.length).toEqual(0);
  });

  it("logs if state is set on invalidate", () => {
    context.state = true;
    setupHooks(context);
    // this calls invalidate
    invalidHook.mock.calls[0][1]();
    expect(context.state).toEqual(false);
    expect(context.stats).toBeUndefined();
    expect(loggerLog.mock.calls[0][0]).toEqual("Compilation starting...");
  });

  it("sets state, then logs stats and handles callbacks on nextTick from done hook", () => {
    setupHooks(context);
    doneHook.mock.calls[0][1]({
      toString: jest.fn(() => "statsString"),
      hasErrors: jest.fn(() => false),
      hasWarnings: jest.fn(() => false),
    });
    expect(context.stats).toBeTruthy();
    expect(context.state).toBeTruthy();
    expect(nextTick.mock.calls.length).toEqual(1);

    nextTick.mock.calls[0][0]();
    expect(loggerInfo.mock.calls).toMatchSnapshot();
    expect(loggerError.mock.calls.length).toEqual(0);
    expect(loggerWarn.mock.calls.length).toEqual(0);

    expect(cb1.mock.calls[0][0]).toEqual(context.stats);
    expect(cb2.mock.calls[0][0]).toEqual(context.stats);
  });

  it("stops on done if invalidated before nextTick", () => {
    setupHooks(context);
    doneHook.mock.calls[0][1]("stats");
    expect(context.stats).toEqual("stats");
    expect(context.state).toBeTruthy();
    expect(nextTick.mock.calls.length).toEqual(1);
    context.state = false;
    nextTick.mock.calls[0][0]();
    expect(loggerInfo.mock.calls.length).toEqual(0);
  });

  it("handles multi compiler", () => {
    context.compiler.compilers = [
      {
        options: {
          name: "comp1",
          stats: {},
        },
      },
      {
        options: {
          name: "comp2",
          stats: {},
        },
      },
    ];
    setupHooks(context);
    doneHook.mock.calls[0][1]({
      stats: [
        {
          toString: jest.fn(() => "statsString1"),
          hasErrors: jest.fn(() => true),
          hasWarnings: jest.fn(() => false),
        },
        {
          toString: jest.fn(() => "statsString2"),
          hasErrors: jest.fn(() => false),
          hasWarnings: jest.fn(() => true),
        },
      ],
    });
    expect(context.stats).toBeTruthy();
    expect(context.state).toBeTruthy();
    expect(nextTick.mock.calls.length).toEqual(1);

    nextTick.mock.calls[0][0]();
    expect(loggerInfo.mock.calls).toMatchSnapshot();
    expect(loggerError.mock.calls).toMatchSnapshot();
    expect(loggerWarn.mock.calls).toMatchSnapshot();

    expect(cb1.mock.calls[0][0]).toEqual(context.stats);
    expect(cb2.mock.calls[0][0]).toEqual(context.stats);
  });
});
