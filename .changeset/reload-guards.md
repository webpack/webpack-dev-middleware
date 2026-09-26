---
"webpack-dev-middleware": patch
---

Do not reload a page that is already navigating away, and reload the nearest ancestor that has a url of its own when the app runs in an `about:blank` iframe
