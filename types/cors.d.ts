/**
 * The resolved answer to "may this origin read the stream": no origin may, any
 * origin may, or ask this.
 */
export type CorsGrant = false | "*" | ((origin: string) => boolean);
export type IncomingMessage = import("node:http").IncomingMessage;
export type CorsOption = import("./hot.js").CorsOption;
export type CorsOrigin = import("./hot.js").CorsOrigin;
export type Logger = import("./hot.js").Logger;
export const CORS_LOCAL_ORIGINS: RegExp;
export const HOT_DEFAULT_CORS_SSE: true;
export const HOT_DEFAULT_CORS_WS: RegExp;
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
export function applyCors(
  grant: CorsGrant,
  req: IncomingMessage,
  headers: Record<string, string>,
): void;
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
export function isSameOrigin(req: IncomingMessage, origin: string): boolean;
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
export function isUpgradeAllowed(
  grant: CorsGrant,
  req: IncomingMessage,
): boolean;
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
export function matchOrigin(origin: string, allowed: CorsOrigin): boolean;
/**
 * Read the `cors` option once, so each request costs a call rather than a walk
 * back through every form the option can take.
 * @param {CorsOption} cors the option, as it was given, or the transport's default when it was not
 * @returns {CorsGrant} the resolved answer
 */
export function resolveCors(cors: CorsOption): CorsGrant;
