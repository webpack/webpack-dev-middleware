module.exports = {
  testEnvironment: "node",
  collectCoverage: false,
  coveragePathIgnorePatterns: ["test", "<rootDir>/node_modules"],
  moduleFileExtensions: ["js", "json"],
  testMatch: ["**/test/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/setupTest.js"],
  globalSetup: "<rootDir>/scripts/globalSetup.js",
  snapshotResolver: "./test/helpers/snapshotResolver.js",
};
