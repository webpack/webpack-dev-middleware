# Hot module replacement with a MultiCompiler

Same setup as the [hot example](../hot), but with **two compilers** ("app" and
"admin") sharing one middleware instance. Both bundles run on the same page
and share a single SSE connection; each carries the client runtime with
`?name=<compilation name>` so it only applies updates for its own compiler.

## What it shows

- One `{ hot: true }` middleware serving events for every compiler.
- Scoping each bundle's client with `?name=` in a MultiCompiler.
- Per-compilation error tracking in the overlay: one bundle's clean build
  does not hide another bundle's still-valid errors.
- Why each configuration needs a distinct `output.uniqueName`: with both
  bundles on one page, a shared `webpackHotUpdate…` global would make each
  bundle's hot updates land in the wrong runtime.

## Files

| File                  | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `server.js`           | Express server mounting the middleware with `hot: true`.        |
| `webpack.config.js`   | MultiCompiler ("app" + "admin") with per-bundle client entries. |
| `src/index.js`        | "app" entry that accepts updates via `module.hot`.              |
| `src/render.js`       | Edit to rebuild only the "app" bundle.                          |
| `src/admin.js`        | "admin" entry, hot-updated independently from "app".            |
| `src/admin-render.js` | Edit to rebuild only the "admin" bundle.                        |
| `public/index.html`   | Demo page that loads both bundles.                              |

## Running

From the repository root, build the package first so `dist/` and `client/`
exist:

```bash
npm run build
node examples/hot-multi-compiler/server.js
```

Then open <http://localhost:3000>.

## Things to try

- Edit `src/render.js` — only "app" rebuilds and hot-updates; "admin" just
  publishes a `sync` event.
- Break `src/render.js` (e.g. leave a dangling `const x =`) so the overlay
  shows the "app" errors, then save `src/admin-render.js` — the successful
  "admin" build does **not** clear the overlay: the reporter tracks problems
  per compilation, so "app"'s errors stay visible until "app" itself builds
  clean.
- Break both files to see the union of their errors in one overlay.
