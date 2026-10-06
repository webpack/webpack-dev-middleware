---
"webpack-dev-middleware": patch
---

Keep the `?<prefix>-hot=false` and `?<prefix>-live-reload=false` page-url parameters working. `apply` replaced the booleans they stood for, and a page opting out through its url, as webpack-dev-server's pages do, stopped being able to; they now narrow the mode in force again, and `apply` in the url wins over them.
