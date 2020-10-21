import src from '../src';
// using require directly to avoid implicit interop giving a false positive
const cjs = require('../src/cjs');

describe('cjs', () => {
  it('should work', () => {
    expect(cjs).toEqual(src);
  });
});
