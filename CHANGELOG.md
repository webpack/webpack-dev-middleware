# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
