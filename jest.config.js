/** @typedef import('ts-jest') */
/** @type {import('@jest/types/build/Config').InitialOptions} */
module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  collectCoverage: false,
  coveragePathIgnorePatterns: ['test', '<rootDir>/node_modules'],
  testMatch: ['**/test/**/*.test.js'],
  testTimeout: 20000,
  globals: {
    'ts-jest': {
      tsConfig: require.resolve('./tsconfig.test.json'),
      isolatedModules: true,
    },
  },
};
