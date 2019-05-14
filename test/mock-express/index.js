const mockRequest = (options = {}) =>
  Object.assign(
    {
      body: {},
      cookies: {},
      query: {},
      params: {},
      get: jest.fn(),
    },
    options
  );

const mockResponse = (options = {}) => {
  const res = Object.assign(
    {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      download: jest.fn(),
      format: jest.fn(),
      json: jest.fn(),
      jsonp: jest.fn(),
      send: jest.fn(),
      sendFile: jest.fn(),
      sendStatus: jest.fn(),
      setHeader: jest.fn(),
      redirect: jest.fn(),
      render: jest.fn(),
      end: jest.fn(),
      set: jest.fn(),
      type: jest.fn(),
      get: jest.fn(),
    },
    options
  );
  res.status = jest.fn(() => res);
  res.vary = jest.fn(() => res);
  return res;
};

module.exports = { mockRequest, mockResponse };
