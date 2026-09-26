/* global WorkerGlobalScope */

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/**
 * Whether there is a page to talk to at all. A worker has none — and
 * `WorkerGlobalScope` is not declared where there is no worker, hence the
 * `typeof` guard on it.
 * @returns {boolean} true when `postMessage` reaches a page
 */
function canPost() {
  return (
    typeof self !== "undefined" &&
    (typeof WorkerGlobalScope === "undefined" ||
      !(self instanceof WorkerGlobalScope))
  );
}

/**
 * Announce what the client just handled to whoever else is on the page, so a
 * plugin or a framework's dev tooling can follow a build without reaching into
 * this module. The `webpack` prefix and the payloads match what
 * webpack-dev-server's client has always posted, because the consumers of
 * these messages are the same ones.
 * @param {string} type message type, without the `webpack` prefix
 * @param {EXPECTED_ANY=} data payload
 */
export default function sendMessage(type, data) {
  if (!canPost()) {
    return;
  }

  self.postMessage({ type: `webpack${type}`, data }, "*");
}

/**
 * Post a message exactly as given, for the one webpack-dev-server sends as a
 * bare string rather than in the `{ type, data }` shape.
 * @param {EXPECTED_ANY} message the message to post
 */
sendMessage.raw = (message) => {
  if (!canPost()) {
    return;
  }

  self.postMessage(message, "*");
};
