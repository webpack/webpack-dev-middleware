---
"webpack-dev-middleware": patch
---

Deprecated the `hot.progress` option; it will be removed in the next major release and keeps working until then. It applied `ProgressPlugin` to your compiler, which leaves a server that applies one itself — webpack-dev-server does — with two of them on one compiler. Apply it yourself and hand the result to [`publish`](https://github.com/webpack/webpack-dev-middleware#publishpayload), rounding the percent and dropping a tick that repeats one as the option did for you. The browser end of this, `hot.client.progress`, is unaffected and stays.
