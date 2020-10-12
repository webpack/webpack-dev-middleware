// this file is called by jest directly so need to use cjs

const { sep, join, dirname, basename } = require('path');

const { version } = require('webpack');

const [webpackVersion] = version;
const snapshotExtension = `.snap.webpack${webpackVersion}`;

module.exports = {
  resolveSnapshotPath: (testPath) =>
    join(
      dirname(testPath),
      '__snapshots__',
      `${basename(testPath)}${snapshotExtension}`
    ),
  resolveTestPath: (snapshotPath) =>
    snapshotPath
      .replace(`${sep}__snapshots__`, '')
      .slice(0, -snapshotExtension.length),
  testPathForConsistencyCheck: join(
    'consistency_check',
    '__tests__',
    'example.test.js'
  ),
};
