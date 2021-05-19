import fs from "fs";
import path from "path";

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
    expect(assetEmittedHook.mock.calls.length).toEqual(1);
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
      cb
    );

    // the getPath helper is not needed for webpack@5
    expect(getPath.mock.calls.length).toEqual(0);

    expect(filter.mock.calls.length).toEqual(1);
    expect(filter.mock.calls[0][0]).toEqual("targetPath");
    // the callback should always be called
    expect(cb.mock.calls.length).toEqual(1);
    // the filter prevents a directory from being made
    expect(mkdirSpy.mock.calls.length).toEqual(0);
  });

  it("handles query string with webpack@4", () => {
    const filter = jest.fn(() => false);
    context.options = {
      writeToDisk: filter,
    };
    setupWriteToDisk(context);
    const cb = jest.fn();
    // webpack@4 info style
    runAssetEmitted(
      "file?query=example",
      {
        targetPath: "targetPath",
      },
      cb
    );

    // the getPath helper is needed for webpack@4
    expect(getPath.mock.calls.length).toEqual(1);

    expect(filter.mock.calls.length).toEqual(1);
    // need to fix path for windows test
    expect(filter.mock.calls[0][0]).toEqual(path.join("/output/path/file"));
    // the callback should always be called
    expect(cb.mock.calls.length).toEqual(1);
    // the filter prevents a directory from being made
    expect(mkdirSpy.mock.calls.length).toEqual(0);
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

  writeErrors.forEach((writeError) => {
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
        cb
      );

      // the getPath helper is not needed for webpack@5
      expect(getPath.mock.calls.length).toEqual(0);

      expect(mkdirSpy.mock.calls.length).toEqual(1);
      expect(mkdirSpy.mock.calls[0][0]).toEqual("/target/path");

      // simulates the mkdir callback being called
      mkdirSpy.mock.calls[0][2](writeError.mkdirError);

      if (writeError.mkdirError) {
        expect(writeFileSpy.mock.calls.length).toEqual(0);
      } else {
        expect(writeFileSpy.mock.calls.length).toEqual(1);
        expect(writeFileSpy.mock.calls[0][0]).toEqual("/target/path/file");
        expect(writeFileSpy.mock.calls[0][1]).toEqual("content");

        // simulates the writeFile callback being called
        writeFileSpy.mock.calls[0][2](writeError.writeFileError);
      }

      // expected logs based on errors
      expect(context.logger.error.mock.calls).toMatchSnapshot();
      expect(context.logger.log.mock.calls).toMatchSnapshot();

      // the callback should always be called
      expect(cb.mock.calls.length).toEqual(1);
      // no errors are expected
      expect(cb.mock.calls).toMatchSnapshot();
    });
  });
});
