module.exports = {
  testEnvironment: "node",
  collectCoverage: false,
  coveragePathIgnorePatterns: ["test", "<rootDir>/node_modules"],
  moduleFileExtensions: ["js", "json"],
  testMatch: ["**/test/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/setupTest.js"],
  globalSetup: "./test/helpers/globalSetup.js",
  snapshotResolver: "./test/helpers/snapshotResolver.js",
  // TODO remove this when `hono` fix this problem - https://github.com/honojs/node-server/issues/233
  retryTimes: 3,
};
