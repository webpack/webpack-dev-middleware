# Hot module replacement example

A minimal [Express](https://expressjs.com/) server that uses
`webpack-dev-middleware` with the `hot` option to enable hot module replacement
over [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

## What it shows

- Enabling HMR with a single `{ hot: true }` option.
- Wiring the browser runtime shipped as `webpack-dev-middleware/client` as a
  webpack entry, together with `HotModuleReplacementPlugin`.
- Accepting updates with `module.hot.accept` so edits apply without a full
  page reload.

## Files

| File                | Purpose                                                         |
| ------------------- | --------------------------------------------------------------- |
| `server.js`         | Express server mounting the middleware with `hot: true`.        |
| `webpack.config.js` | Adds the client runtime entry and `HotModuleReplacementPlugin`. |
| `src/index.js`      | App entry that accepts updates via `module.hot`.                |
| `src/render.js`     | The module you edit to see HMR in action.                       |
| `public/index.html` | Demo page that loads the bundle.                                |

## Running

From the repository root, build the package first so `dist/` and `client/`
exist (the example imports `webpack-dev-middleware` and
`webpack-dev-middleware/client` by name):

```bash
npm run build
node examples/hot/server.js
```

Then open <http://localhost:3000> and edit `examples/hot/src/render.js`. The
page updates in place — no reload.

Open your browser's console to see the client runtime log the HMR lifecycle
(`[webpack-dev-middleware] connected`, `App is up to date.`, …). Server-side
logs (`Client connected`, build status) are printed through webpack's
[infrastructure logger](https://webpack.js.org/configuration/other-options/#infrastructurelogging);
set `infrastructureLogging: { level: "log" }` in the webpack config to see them.
