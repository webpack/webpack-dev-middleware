# Shared overlay example

Two separately compiled bundles on one page — each carrying its **own copy**
of the overlay module — rendering into a **single shared overlay**. This is
the integration model for webpack-dev-server adopting
`webpack-dev-middleware/client/overlay`.

## What it shows

- The overlay state lives in a `window` singleton: a second bundled copy of
  the module adopts the existing iframe instead of stacking a duplicate.
- Each client reports through its own `source` slot and the overlay renders
  the union of every slot (with errors taking precedence over warnings).
- `clear(source)` drops one client's problems without touching the rest;
  dismissing the overlay (Esc, backdrop, ×) clears everything.

## Files

| File                | Purpose                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| `server.js`         | Express server mounting one middleware instance with `hot: true`.           |
| `webpack.config.js` | Two compilations: "app" (SSE hot client) and "widget" (standalone overlay). |
| `src/app.js`        | App entry that accepts updates via `module.hot`.                            |
| `src/render.js`     | Break this file to produce build errors from the "app" client.              |
| `src/widget.js`     | Second client: reports its own problems through the `source` slot.          |
| `public/index.html` | Demo page loading both bundles.                                             |

## Running

From the repository root, build the package first so `dist/` and `client/`
exist (the example imports `webpack-dev-middleware` by name):

```bash
npm run build
node examples/hot-shared-overlay/server.js
```

Then open <http://localhost:3000> and try:

1. **One overlay, two clients:** click "Report widget error", then break
   `src/render.js` (e.g. leave a dangling `const x =`) and save — both
   clients' errors are paginated together in the same overlay.
2. **Per-source clearing:** click "Widget recovered" — only the widget's
   problems disappear; the build errors (if any) stay on screen.
