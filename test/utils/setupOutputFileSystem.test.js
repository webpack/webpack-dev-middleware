import memfs from "memfs";

import setupOutputFileSystem from "../../src/utils/setupOutputFileSystem";

const createFsFromVolume = jest.spyOn(memfs, "createFsFromVolume");

createFsFromVolume.mockImplementation(() => {
  return {
    testFs: true,
  };
});

describe("setupOutputFileSystem", () => {
  afterEach(() => {
    createFsFromVolume.mockClear();
  });

  it("should create default fs if not provided", () => {
    const context = {
      compiler: {},
      options: {},
    };

    setupOutputFileSystem(context);

    // make sure that this is the default fs created
    expect(context.compiler.outputFileSystem.testFs).toBeTruthy();
    expect(context.outputFileSystem.testFs).toBeTruthy();
    expect(createFsFromVolume.mock.calls.length).toEqual(1);
  });

  it("should set fs for multi compiler", () => {
    const context = {
      compiler: {
        compilers: [{}, {}],
      },
      options: {},
    };

    setupOutputFileSystem(context);

    context.compiler.compilers.forEach((comp) => {
      expect(comp.outputFileSystem).toBeTruthy();
    });
  });

  it("should use provided fs with correct methods", () => {
    const context = {
      compiler: {},
      options: {
        outputFileSystem: {
          join: () => {},
          mkdirp: () => {},
        },
      },
    };

    setupOutputFileSystem(context);

    expect(context.outputFileSystem).toEqual(context.options.outputFileSystem);
  });
});
