import ready from "../../src/utils/ready";

describe("ready", () => {
  it("should call callback if state is true", () => {
    const cb = jest.fn();
    const context = {
      state: true,
      stats: "stats",
    };
    ready(context, cb);

    expect(cb.mock.calls.length).toEqual(1);
    expect(cb.mock.calls[0]).toEqual(["stats"]);
  });

  it("should save callback and log req.url if state is false with req.url set", () => {
    const cb = jest.fn();
    const context = {
      state: false,
      stats: "stats",
      logger: {
        info: jest.fn(),
      },
      callbacks: [],
    };
    const req = {
      url: "url",
    };
    ready(context, cb, req);

    expect(cb).not.toBeCalled();
    expect(context.logger.info.mock.calls.length).toEqual(1);
    expect(context.logger.info.mock.calls[0]).toEqual([
      "wait until bundle finished: url",
    ]);
    expect(context.callbacks).toEqual([cb]);
  });

  it("should save callback and log callback.name if state is false with req.url not set", () => {
    const cb = jest.fn();
    const context = {
      state: false,
      stats: "stats",
      logger: {
        info: jest.fn(),
      },
      callbacks: [],
    };
    ready(context, cb);

    expect(cb).not.toBeCalled();
    expect(context.logger.info.mock.calls.length).toEqual(1);
    // mockConstructor is the name of the jest.fn() function
    expect(context.logger.info.mock.calls[0]).toEqual([
      "wait until bundle finished: mockConstructor",
    ]);
    expect(context.callbacks).toEqual([cb]);
  });
});
