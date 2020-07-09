import handleRangeHeaders from '../../src/utils/handleRangeHeaders';

describe('handleRangeHeaders', () => {
  it('should return content in range with valid range header', () => {
    const content = 'abcdef';
    const req = {
      headers: {
        range: 'bytes=1-4',
      },
    };

    const res = {
      setHeader: jest.fn(),
    };

    const contentRes = handleRangeHeaders(content, req, res);
    expect(contentRes).toEqual('bcde');
    expect(res.statusCode).toEqual(206);
    expect(res.setHeader.mock.calls).toMatchSnapshot();
  });

  it('should handle malformed range header', () => {
    const content = 'abcdef';
    const req = {
      headers: {
        range: 'abc',
      },
    };

    const res = {
      setHeader: jest.fn(),
    };

    const contentRes = handleRangeHeaders(content, req, res);
    expect(contentRes).toEqual('abcdef');
    expect(res.statusCode).toBeUndefined();
    expect(res.setHeader.mock.calls).toMatchSnapshot();
  });

  it('should handle unsatisfiable range', () => {
    const content = 'abcdef';
    const req = {
      headers: {
        range: 'bytes=10-20',
      },
    };

    const res = {
      setHeader: jest.fn(),
    };

    const contentRes = handleRangeHeaders(content, req, res);
    expect(contentRes).toEqual('abcdef');
    expect(res.statusCode).toEqual(416);
    expect(res.setHeader.mock.calls).toMatchSnapshot();
  });

  it('should handle multiple ranges', () => {
    const content = 'abcdef';
    const req = {
      headers: {
        range: 'bytes=1-2,4-5',
      },
    };

    const res = {
      setHeader: jest.fn(),
    };

    const contentRes = handleRangeHeaders(content, req, res);
    expect(contentRes).toEqual('abcdef');
    expect(res.statusCode).toBeUndefined();
    expect(res.setHeader.mock.calls).toMatchSnapshot();
  });
});
