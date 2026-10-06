---
"webpack-dev-middleware": minor
---

pr: #2444

Added `hot.cors` to choose which origins may reach the hot endpoint: Server-Sent Events still allow every origin until the next major release, while the new WebSocket transport allows only local origins and refuses others with `403` before the handshake. Added `hot.token`, a secret the injected client carries and the endpoint requires, for the case where a browser sends no `Origin`; it is off by default.
