const { version } = require("webpack");

module.exports = () =>
  // eslint-disable-next-line no-console
  console.log(`\n Running tests for webpack @${version} \n`);
