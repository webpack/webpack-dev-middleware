// The connection the runtime holds, for tooling that listens alongside it.
//
// `client` is live: `null` until the runtime connects and while it is
// reconnecting, and the current transport instance otherwise, whose own
// `client` is the `WebSocket` or `EventSource` underneath. It is the same
// shape webpack-dev-server's `client/socket` has always exported, which is
// how `@pmmmwh/react-refresh-webpack-plugin` reads its build messages.
export { client } from "./clients/createSocket.js";
