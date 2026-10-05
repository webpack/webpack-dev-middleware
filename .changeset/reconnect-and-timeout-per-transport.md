---
"webpack-dev-middleware": patch
---

`hot.client.connect.retries` (`hot.client.reconnect` before it was replaced, still accepted) now applies to Server-Sent Events as well. It was overridden to `Infinity` there, so asking for a bounded number of attempts over the default transport did nothing. Unset still means "keep trying for as long as the page is open", since a dev server is expected to come back and a tab left open across a restart has to find it again.

`hot.client.connect.timeout` (`hot.client.timeout` before it was replaced, still accepted) is documented as Server-Sent Events only, which is what it always was: that transport sends its heartbeat as data the client can see, while a WebSocket sends a protocol ping the browser answers without telling JavaScript — a silence watchdog there would fire on a healthy idle connection, and the half-open case it would catch is handled by the server, which terminates a socket that stops answering. It is no longer handed to a WebSocket client whose constructor takes no options.

Both decisions now live in one place, `client-src/utils/socket-options.js`, with tests for each transport. The documented default for the retry count was wrong for the default transport while it was being ignored there: unset, Server-Sent Events keep trying for as long as the page is open and a WebSocket gives up after 10.
