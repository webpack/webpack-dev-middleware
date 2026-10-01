/** @typedef {import("node:http").IncomingMessage} IncomingMessage */
/** @typedef {import("./hot.js").CorsOption} CorsOption */
/** @typedef {import("./hot.js").CorsOrigin} CorsOrigin */
/** @typedef {import("./hot.js").Logger} Logger */

const { getRequestHeader } = require("./utils.js");

// Only the machine the build is running on: `localhost` and anything under it,
// `127.0.0.1` and `[::1]`, on any port and either scheme. A page on another
// port of the same machine is the one cross-origin case that is normal in
// development, and nothing a remote site can be served from matches this. The
// same default, and the same reasoning, as Vite's `server.cors`.
//
// Anchored at both ends on purpose: `http://localhost.evil.example` must not
// read as a local origin.
const HOT_DEFAULT_CORS =
  /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

/**
 * The resolved answer to "may this origin read the stream": no origin may, any
 * origin may, or ask this.
 * @typedef {false | "*" | ((origin: string) => boolean)} CorsGrant
 */

/**
 * Does one origin match what the `cors` option allows?
 * @param {string} origin the origin the request carried
 * @param {CorsOrigin} allowed what the option allows
 * @returns {boolean} true when the origin is allowed
 */
function matchOrigin(origin, allowed) {
  if (typeof allowed === "function") {
    return Boolean(allowed(origin));
  }

  if (typeof allowed === "string") {
    return allowed === "*" || allowed === origin;
  }

  if (Array.isArray(allowed)) {
    for (const each of allowed) {
      if (matchOrigin(origin, each)) {
        return true;
      }
    }

    return false;
  }

  // `test()` on a `g` or `y` pattern leaves `lastIndex` at the end of the
  // match, and the option is resolved once and reused for every request — so
  // the next request from the same origin would start matching mid-string and
  // be refused, alternating allowed and not. Only those two flags read
  // `lastIndex`, so only they need it reset.
  if (allowed.global || allowed.sticky) {
    allowed.lastIndex = 0;
  }

  return allowed.test(origin);
}

/**
 * Read the `cors` option once, so each request costs a call rather than a walk
 * back through every form the option can take.
 * @param {CorsOption=} cors the option, as it was given
 * @returns {CorsGrant} the resolved answer
 */
function resolveCors(cors = HOT_DEFAULT_CORS) {
  if (cors === false || cors === true) {
    return cors && "*";
  }

  // `{ origin }`, as Vite and `expressjs/cors` are configured, so a
  // configuration written for one of those reads the same here.
  const allowed =
    typeof cors === "object" &&
    !Array.isArray(cors) &&
    !(cors instanceof RegExp)
      ? cors.origin
      : cors;

  if (allowed === false || typeof allowed === "undefined") {
    return false;
  }

  if (allowed === "*") {
    return "*";
  }

  // `origin: true` reflects whatever asked, which is how `expressjs/cors`
  // reads it — every origin, but named rather than wildcarded.
  if (allowed === true) {
    return () => true;
  }

  return (origin) => matchOrigin(origin, allowed);
}

/**
 * Is this request's origin the one it was sent to?
 *
 * The middleware never knows the url it is mounted under, so its own origin is
 * only ever readable from the request: whatever answered is whatever the client
 * addressed. Both sides carry the port when it is not the scheme's default, so
 * they are compared as they arrived.
 * @param {IncomingMessage} req the request
 * @param {string} origin the `Origin` it carried
 * @returns {boolean} true when the two are the same origin
 */
function isSameOrigin(req, origin) {
  try {
    // `"null"` — what a sandboxed frame or a `file:` page sends — does not
    // parse, and so is never the same origin as anything.
    return new URL(origin).host === getRequestHeader(req, "host");
  } catch {
    return false;
  }
}

/**
 * Add the cross-origin grant the `cors` option asks for, if any.
 *
 * Without a grant the browser will not hand a cross-origin `EventSource`
 * response to the page, which is what keeps a build's errors — module paths and
 * the source frames webpack puts in a parse error — from being readable by any
 * site the developer happens to have open. Nothing is rejected: the request is
 * answered either way, and the browser decides what to do with it.
 *
 * No same-origin case to handle here, unlike an upgrade: a browser sends no
 * `Origin` at all for a same-origin `EventSource`, and would not consult these
 * headers if it did.
 * @param {CorsGrant} grant the resolved grant
 * @param {IncomingMessage} req the request joining the stream
 * @param {Record<string, string>} headers the response headers, added to in place
 */
function applyCors(grant, req, headers) {
  if (grant === false) {
    return;
  }

  if (grant === "*") {
    headers["Access-Control-Allow-Origin"] = "*";
    return;
  }

  // The header names a single origin, so the request's own is echoed back when
  // it is an allowed one. `Vary` goes out either way: without it a cache that
  // kept this response could hand it to a page on another origin, grant and
  // all.
  headers.Vary = "Origin";

  // Through the framework abstraction: a request does not always carry
  // `headers` of its own — under Hono it answers `getHeader` instead, and
  // reading the property straight off it grants nothing to anyone.
  const origin = getRequestHeader(req, "origin");

  if (typeof origin === "string" && grant(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
}

/**
 * May this WebSocket handshake go ahead?
 *
 * A handshake is not subject to CORS — a browser sends `Origin` and pays no
 * attention to what comes back — so the same option can only be honoured here
 * by refusing the upgrade. Two cases are allowed whatever the option says,
 * because neither is a page on another origin reading the stream.
 *
 * A request with no `Origin` at all is not a browser: browsers always send one
 * on a handshake, while a Node client, a proxy's health check or a test
 * harness does not, and refusing those would break them for nothing.
 *
 * A request whose `Origin` is the one it was addressed to is the page the
 * middleware is serving. `EventSource` gets this for free, since the browser
 * knows a same-origin read needs no grant; an upgrade has to work it out.
 * @param {CorsGrant} grant the resolved grant
 * @param {IncomingMessage} req the request being upgraded
 * @returns {boolean} true when the upgrade may proceed
 */
function isUpgradeAllowed(grant, req) {
  const origin = getRequestHeader(req, "origin");

  if (typeof origin !== "string") {
    return true;
  }

  if (isSameOrigin(req, origin)) {
    return true;
  }

  if (grant === false) {
    return false;
  }

  return grant === "*" || grant(origin);
}

module.exports.HOT_DEFAULT_CORS = HOT_DEFAULT_CORS;
module.exports.applyCors = applyCors;
module.exports.isSameOrigin = isSameOrigin;
module.exports.isUpgradeAllowed = isUpgradeAllowed;
module.exports.matchOrigin = matchOrigin;
module.exports.resolveCors = resolveCors;
