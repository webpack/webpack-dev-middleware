---
"webpack-dev-middleware": patch
---

Read the client's options from a module that re-exports it. A package that stands in for `webpack-dev-middleware/client` (such as `webpack-dev-server/client/index.js`) is a module of its own, so a query written on it never reached the client, which connected with its defaults; the stand-in can now leave that query in `__webpack_dev_middleware_client_query__` before requiring the client.
