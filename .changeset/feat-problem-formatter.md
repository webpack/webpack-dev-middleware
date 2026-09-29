---
"webpack-dev-middleware": minor
---

The overlay now takes one of webpack's errors or warnings as it comes, not
only a formatted string:

```js
import { showProblems } from "webpack-dev-middleware/client/overlay";

showProblems("errors", stats.errors, "build");
```

The middleware formats its own payloads on the server, so its client never
needed this. A server that sends webpack's error objects to the browser and
formats them there — which is what webpack-dev-server does — had to write that
formatting itself. It is `webpack-dev-middleware/client/problem` now, and
`formatProblem` is there for a console as well as an overlay:

```js
import { formatProblem } from "webpack-dev-middleware/client/problem";

const { header, body } = formatProblem("error", error);
// "ERROR in ./src/app.js 3:0", "Module parse failed: ..."
```

The server's own formatting reads the same way as a result, which fixes two
things it got wrong. An error webpack names no module for sent a first line
holding a single space — and the overlay reads the first line as the heading,
so it drew a heading with nothing in it; it now sends the message alone. And a
module built by loaders reports its whole request (`babel-loader!./app.js`),
which read as noise where the file is what matters; the file comes first now,
with the request after it, and `file` is used when webpack sets one.
