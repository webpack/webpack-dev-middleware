// The browser e2e suites run serially through `npm run test:e2e` — excluded
// here so the regular run stays parallel. The ignore lifts itself when a
// test/e2e path is requested explicitly (a CLI flag would swallow positional
// file arguments, --testPathIgnorePatterns being variadic).
const runningE2E = process.argv.some((arg) => arg.includes("test/e2e"));

module.exports = {
  testEnvironment: "node",
  collectCoverage: false,
  coveragePathIgnorePatterns: ["test", "<rootDir>/node_modules"],
  moduleFileExtensions: ["js", "json"],
  testMatch: ["**/test/**/*.test.js"],
  testPathIgnorePatterns: runningE2E ? [] : ["/node_modules/", "/test/e2e/"],
  setupFilesAfterEnv: ["<rootDir>/setupTest.js"],
  globalSetup: "./test/helpers/globalSetup.js",
  snapshotResolver: "./test/helpers/snapshotResolver.js",
};
