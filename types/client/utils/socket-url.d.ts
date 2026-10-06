/**
 * Assemble a url from its parts. `new URL()` cannot be used for this: it has
 * no way to say "host unknown, resolve it later", and it re-encodes
 * credentials that are already encoded.
 * @param {{ protocol?: string, username?: string, password?: string, hostname?: string, port?: string, pathname?: string }} parts url parts
 * @returns {string} the url
 */
export function formatUrl(parts: {
  protocol?: string;
  username?: string;
  password?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
}): string;
/**
 * Resolve a path spec into the url to connect to.
 * @param {PathSpec} spec the parts that were given
 * @param {string} fallbackPathname the endpoint's path, when the spec names none
 * @param {("sse" | "ws")=} transport which transport will use the url
 * @returns {string} the url
 */
export default function resolveSocketUrl(
  spec: PathSpec,
  fallbackPathname: string,
  transport?: ("sse" | "ws") | undefined,
): string;
export type PathSpec = {
  protocol?: string;
  hostname?: string;
  port?: string | number;
  pathname?: string;
  username?: string;
  password?: string;
};
