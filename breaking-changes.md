## Node Version Support

webpack-dev-middleware version 2 and higher will only support Node 6.x and higher. Active
LTS for Node 4.x ended October 31st, 2017 and entered maintenance on that date.
Likewise, the version 1.x branch of webpack-dev-middleware will enter maintenance on
that date.

## Informative Changes

- logging is now handled by [`loglevel`](https://www.npmjs.com/package/loglevel) and follows the same patterns as
`webpack-dev-server`.

## Breaking Changes

- `reportTime` option renamed to `logTime`
- `noInfo` option removed in favor of setting a `logLevel` higher than `'info'`
- `quiet` option removed in favor of `logLevel: 'silent'`
- `reporter` signature changed to `reporter(middlewareOptions, reporterOptions)`
