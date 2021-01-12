module.exports = {
  collectCoverage: false,
  coveragePathIgnorePatterns: ['test', '<rootDir>/node_modules'],
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/test/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/setupTest.js'],
  snapshotResolver: './test/helpers/snapshotResolver.js',
};
