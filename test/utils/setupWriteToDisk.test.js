import fs from "node:fs";

import setupWriteToDisk from "../../src/utils/setupWriteToDisk";

const mkdirSpy = jest.spyOn(fs, "mkdir");
const writeFileSpy = jest.spyOn(fs, "writeFile");

describe("setupWriteToDisk", () => {
  let context;
  const emitHook = jest.fn();
  const assetEmittedHook = jest.fn();
  const getPath = jest.fn((outputPath) => outputPath);

  beforeEach(() => {
    context = {
      compiler: {
        hooks: {
          emit: {
            tap: emitHook,
          },
          assetEmitted: {
            tapAsync: assetEmittedHook,
          },
        },
        outputPath: "/output/path/",
        options: {
          name: "name",
        },
      },
      logger: {
        error: jest.fn(),
        log: jest.fn(),
      },
    };
  });

  afterEach(() => {
    emitHook.mockClear();
    assetEmittedHook.mockClear();
    getPath.mockClear();
    mkdirSpy.mockClear();
    writeFileSpy.mockClear();
  });

  const runAssetEmitted = (...args) => {
    // calls the emit hook callback
    emitHook.mock.calls[0][1]({
      getPath,
    });
    // calls the asset emitted hook
    assetEmittedHook.mock.calls[0][1](...args);
  };

  it("will not tap assetEmitted twice for compiler", () => {
    setupWriteToDisk(context);
    // this simulates the emit hook being called twice
    emitHook.mock.calls[0][1]();
    emitHook.mock.calls[0][1]();
    expect(assetEmittedHook.mock.calls).toHaveLength(1);
  });

  it("filters out unwanted emits with writeToDisk", () => {
    const filter = jest.fn(() => false);
    context.options = {
      writeToDisk: filter,
    };
    setupWriteToDisk(context);
    const cb = jest.fn();
    // webpack@5 info style
    runAssetEmitted(
      null,
      {
        compilation: {},
        targetPath: "targetPath",
      },
      cb,
    );

    // the getPath helper is not needed for webpack@5
    expect(getPath.mock.calls).toHaveLength(0);

    expect(filter.mock.calls).toHaveLength(1);
    expect(filter.mock.calls[0][0]).toBe("targetPath");
    // the callback should always be called
    expect(cb.mock.calls).toHaveLength(1);
    // the filter prevents a directory from being made
    expect(mkdirSpy.mock.calls).toHaveLength(0);
  });

  const writeErrors = [
    {
      title: "with no write errors",
      mkdirError: null,
      writeFileError: null,
    },
    {
      title: "with mkdir error",
      mkdirError: "error1",
      writeFileError: null,
    },
    {
      title: "with writeFile error",
      mkdirError: null,
      writeFileError: "error2",
    },
  ];

  for (const writeError of writeErrors) {
    // eslint-disable-next-line no-loop-func
    it(`tries to create directories and write file if not filtered out ${writeError.title}`, () => {
      context.options = {};
      setupWriteToDisk(context);
      const cb = jest.fn();
      // webpack@5 info style
      runAssetEmitted(
        null,
        {
          compilation: {},
          targetPath: "/target/path/file",
          content: "content",
        },
        cb,
      );

      // the getPath helper is not needed for webpack@5
      expect(getPath.mock.calls).toHaveLength(0);

      expect(mkdirSpy.mock.calls).toHaveLength(1);
      expect(mkdirSpy.mock.calls[0][0]).toBe("/target/path");

      // simulates the mkdir callback being called
      mkdirSpy.mock.calls[0][2](writeError.mkdirError);

      if (writeError.mkdirError) {
        expect(writeFileSpy.mock.calls).toHaveLength(0);
      } else {
        expect(writeFileSpy.mock.calls).toHaveLength(1);
        expect(writeFileSpy.mock.calls[0][0]).toBe("/target/path/file");
        expect(writeFileSpy.mock.calls[0][1]).toBe("content");

        // simulates the writeFile callback being called
        writeFileSpy.mock.calls[0][2](writeError.writeFileError);
      }

      // expected logs based on errors
      expect(context.logger.error.mock.calls).toMatchSnapshot();
      expect(context.logger.log.mock.calls).toMatchSnapshot();

      // the callback should always be called
      expect(cb.mock.calls).toHaveLength(1);
      // no errors are expected
      expect(cb.mock.calls).toMatchSnapshot();
    });
  }
});
