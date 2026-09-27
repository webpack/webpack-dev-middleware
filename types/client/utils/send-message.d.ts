/**
 * Announce what the client just handled to whoever else is on the page, so a
 * plugin or a framework's dev tooling can follow a build without reaching into
 * this module. The `webpack` prefix and the payloads match what
 * webpack-dev-server's client has always posted, because the consumers of
 * these messages are the same ones.
 * @param {string} type message type, without the `webpack` prefix
 * @param {EXPECTED_ANY=} data payload
 */
declare function sendMessage(
  type: string,
  data?: EXPECTED_ANY | undefined,
): void;
declare namespace sendMessage {
  /**
   * Post a message exactly as given, for the one webpack-dev-server sends as a
   * bare string rather than in the `{ type, data }` shape.
   * @param {EXPECTED_ANY} message the message to post
   */
  function raw(message: EXPECTED_ANY): void;
}
export default sendMessage;
export type EXPECTED_ANY = any;
