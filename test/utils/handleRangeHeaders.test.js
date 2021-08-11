import handleRangeHeaders from "../../src/utils/handleRangeHeaders";

describe("handleRangeHeaders", () => {
  let context;

  beforeEach(() => {
    context = {
      logger: {
        error: jest.fn(),
      },
    };
  });

  it("should return content in range with valid range header", () => {
    const content = "abcdef";
    const req = {
      headers: {
        range: "bytes=1-4",
      },
      get(field) {
        return this.headers[field];
      },
    };

    const res = {
      set: jest.fn(),
      status(statusCode) {
        this.statusCode = statusCode;
      },
    };

    const ranges = handleRangeHeaders(context, content.length, req, res);
    expect(ranges).toEqual({ start: 1, end: 4 });
    expect(res.statusCode).toEqual(206);
    expect(res.set.mock.calls).toMatchSnapshot();
  });

  it("should handle malformed range header", () => {
    const content = "abcdef";
    const req = {
      headers: {
        range: "abc",
      },
      get(field) {
        return this.headers[field];
      },
    };

    const res = {
      set: jest.fn(),
      status(statusCode) {
        this.statusCode = statusCode;
      },
    };

    const ranges = handleRangeHeaders(context, content, req, res);
    expect(ranges).toEqual(null);
    expect(context.logger.error.mock.calls).toMatchSnapshot();
    expect(res.statusCode).toBeUndefined();
    expect(res.set.mock.calls).toMatchSnapshot();
  });

  it("should handle unsatisfiable range", () => {
    const content = "abcdef";
    const req = {
      headers: {
        range: "bytes=10-20",
      },
      get(field) {
        return this.headers[field];
      },
    };

    const res = {
      set: jest.fn(),
      status(statusCode) {
        this.statusCode = statusCode;
      },
    };

    const ranges = handleRangeHeaders(context, content.length, req, res);
    expect(ranges).toEqual(null);
    expect(res.statusCode).toEqual(416);
    expect(res.set.mock.calls).toMatchSnapshot();
  });

  it("should handle multiple ranges by sending a regular response", () => {
    const content = "abcdef";
    const req = {
      headers: {
        range: "bytes=1-2,4-5",
      },
      get(field) {
        return this.headers[field];
      },
    };

    const res = {
      set: jest.fn(),
      status(statusCode) {
        this.statusCode = statusCode;
      },
    };

    const ranges = handleRangeHeaders(context, content.length, req, res);
    expect(ranges).toEqual(null);
    expect(context.logger.error.mock.calls).toMatchSnapshot();
    expect(res.statusCode).toBeUndefined();
    expect(res.set.mock.calls).toMatchSnapshot();
  });
});
