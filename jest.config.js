'use strict';

module.exports = {
  collectCoverage: false,
  coveragePathIgnorePatterns: ['test'],
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/test/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/setupTest.js'],
};
