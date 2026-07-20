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

| File                | Purpose                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| `server.js`         | Express server mounting the middleware with `hot: true`.                   |
| `webpack.config.js` | Adds the client runtime entry and `HotModuleReplacementPlugin`.            |
| `src/index.js`      | App entry that accepts updates via `module.hot`.                           |
| `src/render.js`     | The module you edit to see HMR in action (also has runtime-error buttons). |
| `public/index.html` | Demo page that loads the bundle.                                           |

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

## Trying the overlay

- **Multiple build errors:** break `src/render.js` (e.g. leave a dangling
  `const x =`) and save — the overlay lists every error of the failing build.
- **Runtime errors:** click "Throw runtime error" / "Unhandled rejection"
  several times — the overlay accumulates them until dismissed (or until the
  next successful rebuild clears it).
- **Warnings:** start the server with `DEMO_WARNING=1` — every build
  emits a sample warning, shown in the overlay by default. Hide warnings with
  `?overlay={"warnings":false}` on the client entry in `webpack.config.js`.
- **Multi-compiler:** see the dedicated
  [hot-multi-compiler example](../hot-multi-compiler) for two bundles on one
  page with per-compilation error tracking.

Open your browser's console to see the client runtime log the HMR lifecycle
(`[webpack-dev-middleware] connected`, `App is up to date.`, …). Server-side
logs (`Client connected`, build status) are printed through webpack's
[infrastructure logger](https://webpack.js.org/configuration/other-options/#infrastructurelogging);
set `infrastructureLogging: { level: "log" }` in the webpack config to see them.
