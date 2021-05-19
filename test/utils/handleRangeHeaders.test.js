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

    const contentRes = handleRangeHeaders(context, content, req, res);
    expect(contentRes).toEqual("bcde");
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

    const contentRes = handleRangeHeaders(context, content, req, res);
    expect(contentRes).toEqual("abcdef");
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

    const contentRes = handleRangeHeaders(context, content, req, res);
    expect(contentRes).toEqual("abcdef");
    expect(res.statusCode).toEqual(416);
    expect(res.set.mock.calls).toMatchSnapshot();
  });

  it("should handle multiple ranges", () => {
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

    const contentRes = handleRangeHeaders(context, content, req, res);
    expect(contentRes).toEqual("abcdef");
    expect(context.logger.error.mock.calls).toMatchSnapshot();
    expect(res.statusCode).toBeUndefined();
    expect(res.set.mock.calls).toMatchSnapshot();
  });
});
