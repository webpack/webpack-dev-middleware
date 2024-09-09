# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [7.4.2](https://github.com/webpack/webpack-dev-middleware/compare/v7.4.1...v7.4.2) (2024-08-21)


### Bug Fixes

* no crash when headers are already sent ([#1929](https://github.com/webpack/webpack-dev-middleware/issues/1929)) ([c20f1d9](https://github.com/webpack/webpack-dev-middleware/commit/c20f1d98dff9b51931fae44a44fbc53387768673))

### [7.4.1](https://github.com/webpack/webpack-dev-middleware/compare/v7.4.0...v7.4.1) (2024-08-20)


### Bug Fixes

* `assetsInfo` may be undefined (rspack) ([#1927](https://github.com/webpack/webpack-dev-middleware/issues/1927)) ([21f1797](https://github.com/webpack/webpack-dev-middleware/commit/21f1797ee8aecdae7a2bfb0f8b06ce88e987dfb8))

## [7.4.0](https://github.com/webpack/webpack-dev-middleware/compare/v7.3.0...v7.4.0) (2024-08-15)


### Features

* added the cacheImmutable option to cache immutable assets (assets with a hash in file name like `image.e12ab567.jpg`) ([5ed629d](https://github.com/webpack/webpack-dev-middleware/commit/5ed629da0d432fefdd3b5191985ce93c3aab2624))
* allow to configure the `Cache-Control` header ([#1923](https://github.com/webpack/webpack-dev-middleware/issues/1923)) ([f7529c3](https://github.com/webpack/webpack-dev-middleware/commit/f7529c3188efa1885593993d912155ef2188fda5))


### Bug Fixes

* support `devServer: false` ([b443f4d](https://github.com/webpack/webpack-dev-middleware/commit/b443f4df9f38502b73707073a6e2a21e1a9c684a))

## [7.3.0](https://github.com/webpack/webpack-dev-middleware/compare/v7.2.1...v7.3.0) (2024-07-18)


### Features

* support hono ([#1890](https://github.com/webpack/webpack-dev-middleware/issues/1890)) ([0f9f398](https://github.com/webpack/webpack-dev-middleware/commit/0f9f3983b6e342e39032a585a64a4c638f8bfbfd))

### [7.2.1](https://github.com/webpack/webpack-dev-middleware/compare/v7.2.0...v7.2.1) (2024-04-02)


### Bug Fixes

* avoid extra log

## [7.2.0](https://github.com/webpack/webpack-dev-middleware/compare/v7.1.1...v7.2.0) (2024-03-29)


### Features

* hapi support ([b3f9126](https://github.com/webpack/webpack-dev-middleware/commit/b3f9126cfb659c95c0cd77d97eed168c7941c8a8))
* koa support ([#1792](https://github.com/webpack/webpack-dev-middleware/issues/1792)) ([458c17c](https://github.com/webpack/webpack-dev-middleware/commit/458c17c372a2a1a5a33f8923998dba88d2644135))
* support `ETag` header generation ([#1797](https://github.com/webpack/webpack-dev-middleware/issues/1797)) ([b759181](https://github.com/webpack/webpack-dev-middleware/commit/b75918163284495dae5a2f995c2d93805fccfbd7))
* support `Last-Modified` header generation ([#1798](https://github.com/webpack/webpack-dev-middleware/issues/1798)) ([18e5683](https://github.com/webpack/webpack-dev-middleware/commit/18e56833327084c22c1ee6bdad123095a68d144a))

### [7.1.1](https://github.com/webpack/webpack-dev-middleware/compare/v7.1.0...v7.1.1) (2024-03-21)


### Bug Fixes

* `ContentLength` incorrectly set for empty files ([#1785](https://github.com/webpack/webpack-dev-middleware/issues/1785)) ([0f3e25e](https://github.com/webpack/webpack-dev-middleware/commit/0f3e25e2b0adbc081ba4c7df70467c6ed7bc3a2a))
* improve perf ([#1777](https://github.com/webpack/webpack-dev-middleware/issues/1777)) ([5b47c92](https://github.com/webpack/webpack-dev-middleware/commit/5b47c9294ec612e337f87101a4df1ca011b50ace))
* **types:** make types better ([#1786](https://github.com/webpack/webpack-dev-middleware/issues/1786)) ([e4d183e](https://github.com/webpack/webpack-dev-middleware/commit/e4d183ea6dea1731b69e24d5d5471d876ff6ec3a))

## [7.1.0](https://github.com/webpack/webpack-dev-middleware/compare/v7.0.0...v7.1.0) (2024-03-19)


### Features

* prefer to use `fs.createReadStream` over `fs.readFileSync` to read files ([ab533de](https://github.com/webpack/webpack-dev-middleware/commit/ab533de933c6684218172b86992f35c3ca6c58a4))


### Bug Fixes

* cleaup stream and handle errors ([#1769](https://github.com/webpack/webpack-dev-middleware/issues/1769)) ([1258fdd](https://github.com/webpack/webpack-dev-middleware/commit/1258fdd3d9c175dbacf6bc3b36d5c3c545738f13))
* **security:** do not allow to read files above ([#1771](https://github.com/webpack/webpack-dev-middleware/issues/1771)) ([e10008c](https://github.com/webpack/webpack-dev-middleware/commit/e10008c762e4d5821ed6990348dabf0d4d93a10e))

## [7.0.0](https://github.com/webpack/webpack-dev-middleware/compare/v6.1.1...v7.0.0) (2023-12-26)


### ⚠ BREAKING CHANGES

* minimum supported Node.js version is 18.12.0 (#1694)
* updated memfs@4 (#1693)

### Features

* updated memfs@4 ([#1693](https://github.com/webpack/webpack-dev-middleware/issues/1693)) ([244d9f8](https://github.com/webpack/webpack-dev-middleware/commit/244d9f88daa1e3900e5095c58f6b52a4ee53c061))


* minimum supported Node.js version is 18.12.0 ([#1694](https://github.com/webpack/webpack-dev-middleware/issues/1694)) ([e273d61](https://github.com/webpack/webpack-dev-middleware/commit/e273d61ba774ef464399279f347a540762a9a9d7))

### [6.1.1](https://github.com/webpack/webpack-dev-middleware/compare/v6.1.0...v6.1.1) (2023-05-16)


### Bug Fixes

* **types:** `methods` should be string array ([#1550](https://github.com/webpack/webpack-dev-middleware/issues/1550)) ([41b2f77](https://github.com/webpack/webpack-dev-middleware/commit/41b2f77106358acb7a9d518b17b30016c3a15872))

## [6.1.0](https://github.com/webpack/webpack-dev-middleware/compare/v6.0.2...v6.1.0) (2023-05-03)


### Features

* added `mimeTypeDefault` option ([#1527](https://github.com/webpack/webpack-dev-middleware/issues/1527)) ([503d290](https://github.com/webpack/webpack-dev-middleware/commit/503d290b13f33fbbcde6353e98d28f665310655b))
* added `modifyResponseData` option ([#1529](https://github.com/webpack/webpack-dev-middleware/issues/1529)) ([35dac70](https://github.com/webpack/webpack-dev-middleware/commit/35dac7054ce9004a30e434b909c3837e63e3df7d))


### Bug Fixes

* don't use `memory-fs` when `writeToDisk` is `true` ([#1537](https://github.com/webpack/webpack-dev-middleware/issues/1537)) ([852245e](https://github.com/webpack/webpack-dev-middleware/commit/852245e3ef601827c760596cbd0b19e706ebe3ea))
* faster startup time ([f5f033b](https://github.com/webpack/webpack-dev-middleware/commit/f5f033b2ee03c2255ba759a914e3a1ea86c99cf6))

### [6.0.2](https://github.com/webpack/webpack-dev-middleware/compare/v6.0.1...v6.0.2) (2023-03-19)


### Bug Fixes

* make webpack optional peerDep ([#1488](https://github.com/webpack/webpack-dev-middleware/issues/1488)) ([81c39ba](https://github.com/webpack/webpack-dev-middleware/commit/81c39ba7709da6061335686a0a36b82ba8cab40a))

### [6.0.1](https://github.com/webpack/webpack-dev-middleware/compare/v6.0.0...v6.0.1) (2022-11-28)


### Bug Fixes

* update schema for `index` and `methods` properties ([#1397](https://github.com/webpack/webpack-dev-middleware/issues/1397)) ([cda328e](https://github.com/webpack/webpack-dev-middleware/commit/cda328ecd4692b873d9c09c8b2d0fa4bdfbeffe0))

## [6.0.0](https://github.com/webpack/webpack-dev-middleware/compare/v5.3.3...v6.0.0) (2022-11-20)


### ⚠ BREAKING CHANGES

* minimum supported webpack version is 5.0.0
* minimum supported Nodejs version is 14.15.0

### [5.3.3](https://github.com/webpack/webpack-dev-middleware/compare/v5.3.2...v5.3.3) (2022-05-18)


### Bug Fixes

* types for `Request` and `Response` ([#1271](https://github.com/webpack/webpack-dev-middleware/issues/1271)) ([eeb8aa8](https://github.com/webpack/webpack-dev-middleware/commit/eeb8aa8b116038671b7436173fab1994d4645767))

### [5.3.2](https://github.com/webpack/webpack-dev-middleware/compare/v5.3.1...v5.3.2) (2022-05-17)


### Bug Fixes

* node types ([#1195](https://github.com/webpack/webpack-dev-middleware/issues/1195)) ([d68ab36](https://github.com/webpack/webpack-dev-middleware/commit/d68ab3607a43288dbb6efd9ee748ad3e650625a1))

### [5.3.1](https://github.com/webpack/webpack-dev-middleware/compare/v5.3.0...v5.3.1) (2022-02-01)


### Bug Fixes

* types ([#1187](https://github.com/webpack/webpack-dev-middleware/issues/1187)) ([0f82e1d](https://github.com/webpack/webpack-dev-middleware/commit/0f82e1d6ebb9e11c60dc8ee668dd6f953042ada8))

## [5.3.0](https://github.com/webpack/webpack-dev-middleware/compare/v5.2.2...v5.3.0) (2021-12-16)


### Features

* added types ([a2fa77f](https://github.com/webpack/webpack-dev-middleware/commit/a2fa77f87ad4d9912d08a68624e41380821d4d10))
* removed cjs wrapper ([#1146](https://github.com/webpack/webpack-dev-middleware/issues/1146)) ([b6d53d3](https://github.com/webpack/webpack-dev-middleware/commit/b6d53d3f4d43c4c0e646e8d06355f3b4c9893a4f))

### [5.2.2](https://github.com/webpack/webpack-dev-middleware/compare/v5.2.1...v5.2.2) (2021-11-17)


### Chore

* update `schema-utils` package to `4.0.0` version

### [5.2.1](https://github.com/webpack/webpack-dev-middleware/compare/v5.2.0...v5.2.1) (2021-09-25)

* internal release, no visible changes and features

## [5.2.0](https://github.com/webpack/webpack-dev-middleware/compare/v5.1.0...v5.2.0) (2021-09-24)


### Features

* allow array for `headers` option ([#1042](https://github.com/webpack/webpack-dev-middleware/issues/1042)) ([5a6a3f0](https://github.com/webpack/webpack-dev-middleware/commit/5a6a3f0f8e6b0f8fef33629f0f6fa5bed545a88c))

## [5.1.0](https://github.com/webpack/webpack-dev-middleware/compare/v5.0.0...v5.1.0) (2021-09-09)


### Features

* don't read full file if `Range` header is present ([e8b21f0](https://github.com/webpack/webpack-dev-middleware/commit/e8b21f0979c4807b28f7be45aff0d25cca1585ae))
* output more information on errors ([#1024](https://github.com/webpack/webpack-dev-middleware/issues/1024)) ([7df9e44](https://github.com/webpack/webpack-dev-middleware/commit/7df9e449945a852622135f3f0857599ad7b8af64))


### Bug Fixes

* reduced package size by removing `mem` package ([#1027](https://github.com/webpack/webpack-dev-middleware/issues/1027)) ([0d55268](https://github.com/webpack/webpack-dev-middleware/commit/0d55268478f9cbba122855e2be9d7493350d4d5d))

## [5.0.0](https://github.com/webpack/webpack-dev-middleware/compare/v4.3.0...v5.0.0) (2021-06-02)


### ⚠ BREAKING CHANGES

* minimum supported `Node.js` version is `12.13.0` ([#928](https://github.com/webpack/webpack-dev-middleware/issues/928)) ([4cffeff](https://github.com/webpack/webpack-dev-middleware/commit/4cffeffb5fd07ea79e5a7a5a0cdb3f08f3856c06))

## [4.3.0](https://github.com/webpack/webpack-dev-middleware/compare/v4.2.0...v4.3.0) (2021-05-19)


### Features

* add `getFilenameFromUrl` to API ([#911](https://github.com/webpack/webpack-dev-middleware/issues/911)) ([1edc726](https://github.com/webpack/webpack-dev-middleware/commit/1edc7263ff62cfd6456f35e3cb3c2e30c3ac379a))


### Bug Fixes

* husky config ([#904](https://github.com/webpack/webpack-dev-middleware/issues/904)) ([8a423be](https://github.com/webpack/webpack-dev-middleware/commit/8a423bea3f1641e99c1f6fed56630bfe128b62d8))
* typo depandabot -> dependabot ([#905](https://github.com/webpack/webpack-dev-middleware/issues/905)) ([7062990](https://github.com/webpack/webpack-dev-middleware/commit/7062990a55d21d2e35de832ea593f7b088bf054b))

## [4.2.0](https://github.com/webpack/webpack-dev-middleware/compare/v4.1.0...v4.2.0) (2021-05-10)


### Features

* allow the `headers` option to accept function ([#897](https://github.com/webpack/webpack-dev-middleware/issues/897)) ([966afb3](https://github.com/webpack/webpack-dev-middleware/commit/966afb3e331f09912bb9fc5f403e758f586b1a07))

## [4.1.0](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.4...v4.1.0) (2021-01-15)


### Features

* added the `stats` option ([376cdba](https://github.com/webpack/webpack-dev-middleware/commit/376cdba4b6d3f70414d3d1707f80539b7523e486))

### [4.0.4](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.3...v4.0.4) (2021-01-13)


### Bug Fixes

* compatibility with webpack@4 ([#816](https://github.com/webpack/webpack-dev-middleware/issues/816)) ([acdfd4d](https://github.com/webpack/webpack-dev-middleware/commit/acdfd4d8b671ba98b601ea4d53c7dccea3270e73))

### [4.0.3](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.1...v4.0.3) (2021-01-12)


### Bug Fixes

* output `stats` to `stdout` instead `stderr`, how does `webpack-cli`, if you need hide `stats` from output please use `{ stats: false }` or `{ stats: 'none' }` ([4de0f97](https://github.com/webpack/webpack-dev-middleware/commit/4de0f97596d52a7182ac108a9b9865462fca54fe))
* colors are working for `stats` ([4de0f97](https://github.com/webpack/webpack-dev-middleware/commit/4de0f97596d52a7182ac108a9b9865462fca54fe))
* schema description ([#783](https://github.com/webpack/webpack-dev-middleware/issues/783)) ([f9ce2b2](https://github.com/webpack/webpack-dev-middleware/commit/f9ce2b2537c331901e230c5a8452f4b91d45c713))
* skip `Content-type header` on unknown types ([#809](https://github.com/webpack/webpack-dev-middleware/issues/809)) ([5c9eee5](https://github.com/webpack/webpack-dev-middleware/commit/5c9eee549be264f6df202d960b7cd10bfff7f97d))

### [4.0.2](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.1...v4.0.2) (2020-11-10)


### Bug Fixes

* compatibility with the `headers` option ([#763](https://github.com/webpack/webpack-dev-middleware/issues/763)) ([7c4cac5](https://github.com/webpack/webpack-dev-middleware/commit/7c4cac538dc7facf3c3334863ec3a49b14e16630))

### [4.0.1](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.0...v4.0.1) (2020-11-09)


### Bug Fixes

* compatibility with `connect` ([b83a1db](https://github.com/webpack/webpack-dev-middleware/commit/b83a1db264b4fb50361264cf98f102b34413bfaa))

## [4.0.0](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.0-rc.3...v4.0.0) (2020-10-28)


### ⚠ BREAKING CHANGES

* export in CommonJS format

### Bug Fixes

* compatibility with new webpack@5 API ([#737](https://github.com/webpack/webpack-dev-middleware/issues/737)) ([f6054a0](https://github.com/webpack/webpack-dev-middleware/commit/f6054a00e0e804a9d9ef0f4b3075e6116fae6c99))
* handle the `auto` value of the `publicPath` option ([9b4c5ec](https://github.com/webpack/webpack-dev-middleware/commit/9b4c5ec924d8b25d374b95433191d549f9d3717f))
* support webpack@5 ([#702](https://github.com/webpack/webpack-dev-middleware/issues/702)) ([9ccc327](https://github.com/webpack/webpack-dev-middleware/commit/9ccc3276466754bb10e7f5d0b76f63de2a913e92))

## [4.0.0-rc.3](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.0-rc.2...v4.0.0-rc.3) (2020-07-14)

* internal improvements

## [4.0.0-rc.2](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.0-rc.1...v4.0.0-rc.2) (2020-06-30)


### Bug Fixes

* prefer mime type option over built-in ([#670](https://github.com/webpack/webpack-dev-middleware/issues/670)) ([7fa2c15](https://github.com/webpack/webpack-dev-middleware/commit/7fa2c151cfc84001a0116e07532c464aefe9f56c))

## [4.0.0-rc.1](https://github.com/webpack/webpack-dev-middleware/compare/v4.0.0-rc.0...v4.0.0-rc.1) (2020-02-20)


### Bug Fixes

* missing `options.json` file ([#589](https://github.com/webpack/webpack-dev-middleware/issues/589)) ([41d6264](https://github.com/webpack/webpack-dev-middleware/commit/41d6264e44e2963deab37379a34d8ad8a1140d99))

### [4.0.0-rc.0](https://github.com/webpack/webpack-dev-middleware/compare/v3.7.2...v4.0.0-rc.0) (2020-02-19)

### Bug Fixes

* respect `output.path` and `output.publicPath` options from the configuration
* respect the `stats` option from the configuration
* respect the `watchOptions` option from the configuration
* the `writeToDisk` option now correctly works in multi-compiler mode
* the `outputFileSystem` option now correctly works in multi-compiler mode
* respect `[hash]`/`[fullhash]` in `output.path` and `output.publicPath`
* handle exceptions for filesystem operations
* the `Content-Type` header doesn't have `charset=utf-8` value for custom MIME types and MIME types which can be non `utf-8`

### Features

* validate options
* migrate on the `webpack` logger
* migrate on the `memfs` package
* improve performance

### BREAKING CHANGES

* minimum supported Node.js version is `10.13.0`
* the default value of the option `publicPath` is taken from the value of the `output.publicPath` option from the configuration (`webpack.config.js`)
* the `stats` option was removed, the default value of the `stats` option is taken from the value of the `stats` option from the configuration (`webpack.config.js`)
* the `watchOptions` was removed, the default value of the `watchOptions` option is taken from the value of the `watchOptions` option from the configuration (`webpack.config.js`)
* the `Content-Type` header doesn't have `charset=utf-8` value for custom MIME types and MIME types which can be non `utf-8`
* the `fs` option was renamed to the `outputFileSystem` option
* the `lazy` option was removed without replacement
* the `logger`, `logLevel` and `logTime` options were removed without replacement. You can setup the `level` value using `{ infrastructureLogging: { level: 'warn' } }`, please read https://webpack.js.org/configuration/other-options/#infrastructurelogging. You can use the `infrastructurelog` (`infrastructureLog` in `webpack@5`) hook to customize logs. The `log` property in the middleware context was renamed to `logger`
* the `mimeTypes` option first requires you to specify an extension and then a content-type - `{ mimeTypes: { phtml: 'text/html' } }`
* the `force` option from the `mimeTypes` option was removed without replacement 
* the `reporter` option was removed without replacement
* the `getFilenameFromUrl` method was removed from the API
* the middleware `locals` now under `res.locals.webpack` - use `res.locals.webpack.stats` for access `stats` and `res.locals.webpack.outputFileSystem` to access `outputFileSystem`

### [3.7.2](https://github.com/webpack/webpack-dev-middleware/compare/v3.7.1...v3.7.2) (2019-09-28)


### Bug Fixes

* compatibility with webpack@5 ([#473](https://github.com/webpack/webpack-dev-middleware/issues/473)) ([63da9ae](https://github.com/webpack/webpack-dev-middleware/commit/63da9ae))
* memory leak when `writeToDisk` used ([#472](https://github.com/webpack/webpack-dev-middleware/issues/472)) ([6730076](https://github.com/webpack/webpack-dev-middleware/commit/6730076))

### [3.7.1](https://github.com/webpack/webpack-dev-middleware/compare/v3.7.0...v3.7.1) (2019-09-03)


### Bug Fixes

* directly used mkdirp instead of through Webpack ([#436](https://github.com/webpack/webpack-dev-middleware/issues/436)) ([dff39a1](https://github.com/webpack/webpack-dev-middleware/commit/dff39a1))
* displayStats only logged ([#427](https://github.com/webpack/webpack-dev-middleware/issues/427)) ([98deaf4](https://github.com/webpack/webpack-dev-middleware/commit/98deaf4))
* the `writeToFile` option has compatibility with webpack@5 ([#459](https://github.com/webpack/webpack-dev-middleware/issues/459)) ([5c90e1e](https://github.com/webpack/webpack-dev-middleware/commit/5c90e1e))

## [3.7.0](https://github.com/webpack/webpack-dev-middleware/compare/v3.6.2...v3.7.0) (2019-05-15)


### Features

* support `HEAD` method by default ([#398](https://github.com/webpack/webpack-dev-middleware/issues/398)) ([ec3d5eb](https://github.com/webpack/webpack-dev-middleware/commit/ec3d5eb))



<a name="3.6.2"></a>
## [3.6.2](https://github.com/webpack/webpack-dev-middleware/compare/v3.6.1...v3.6.2) (2019-04-03)


### Bug Fixes

* check existence of `res.getHeader` and set the correct Content-Type ([#385](https://github.com/webpack/webpack-dev-middleware/issues/385)) ([56dc705](https://github.com/webpack/webpack-dev-middleware/commit/56dc705))



## [3.6.1](https://github.com/webpack/webpack-dev-middleware/compare/v3.6.0...v3.6.1) (2019-03-06)


### Bug Fixes

* do not overwrite Content-Type if header already exists ([#377](https://github.com/webpack/webpack-dev-middleware/issues/377)) ([b2a6fed](https://github.com/webpack/webpack-dev-middleware/commit/b2a6fed))



<a name="3.5.2"></a>
## [3.5.2](https://github.com/webpack/webpack-dev-middleware/compare/v3.5.1...v3.5.2) (2019-02-06)


### Bug Fixes

* don't add charset to `usdz` file type ([#357](https://github.com/webpack/webpack-dev-middleware/issues/357)) ([b135b3d](https://github.com/webpack/webpack-dev-middleware/commit/b135b3d))



<a name="3.5.1"></a>
## [3.5.1](https://github.com/webpack/webpack-dev-middleware/compare/v3.5.0...v3.5.1) (2019-01-17)


### Bug Fixes

* remove querystring from filenames when writing to disk ([#361](https://github.com/webpack/webpack-dev-middleware/issues/361)) ([90d0d94](https://github.com/webpack/webpack-dev-middleware/commit/90d0d94))



<a name="3.5.0"></a>
# [3.5.0](https://github.com/webpack/webpack-dev-middleware/compare/v3.4.0...v3.5.0) (2019-01-04)


### Bug Fixes

* **middleware:** do not add 'null' to Content-Type ([#355](https://github.com/webpack/webpack-dev-middleware/issues/355)) ([cf4d7a9](https://github.com/webpack/webpack-dev-middleware/commit/cf4d7a9))


### Features

* allow to redefine `mimeTypes` (possible to use `force` option) ([#349](https://github.com/webpack/webpack-dev-middleware/issues/349)) ([e56a181](https://github.com/webpack/webpack-dev-middleware/commit/e56a181))



<a name="3.3.0"></a>
# [3.3.0](https://github.com/webpack/webpack-dev-middleware/compare/v3.2.0...v3.3.0) (2018-09-10)


### Features

* **middleware:** expose the memory filesystem (`response.locals.fs`) ([#337](https://github.com/webpack/webpack-dev-middleware/issues/337)) ([f9a138e](https://github.com/webpack/webpack-dev-middleware/commit/f9a138e))



<a name="3.2.0"></a>
# [3.2.0](https://github.com/webpack/webpack-dev-middleware/compare/v3.1.3...v3.2.0) (2018-08-23)


### Bug Fixes

* **package:** 18 security vulnerabilities ([#329](https://github.com/webpack/webpack-dev-middleware/issues/329)) ([5951de9](https://github.com/webpack/webpack-dev-middleware/commit/5951de9))


### Features

* **middleware:** add `methods` option (`options.methods`) ([#319](https://github.com/webpack/webpack-dev-middleware/issues/319)) ([fe6bb86](https://github.com/webpack/webpack-dev-middleware/commit/fe6bb86))
