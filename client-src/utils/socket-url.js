/**
 * Where the runtime connects, when the page has to work it out for itself.
 *
 * A plain `path` is enough whenever the endpoint is on the page's own origin,
 * which is the usual case. It is not enough behind a proxy, on another host,
 * or on a socket listening on a port of its own: there the parts that differ
 * have to be said, and the parts that do not have to come from wherever the
 * page happens to be — which is known in the browser and nowhere else.
 *
 * So the parts arrive as given and are resolved here, against `self.location`.
 */

/** @typedef {{ protocol?: string, hostname?: string, port?: string | number, pathname?: string, username?: string, password?: string }} PathSpec */

// What the page is addressed by, when there is a page. A worker has a location
// too; nothing here needs one, and a spec that leaves out what it cannot
// resolve is answered with the parts it did give.
/**
 * @returns {Location | { protocol: string, hostname: string, port: string, href: string }} the page's location, or an empty stand-in
 */
function here() {
  return typeof self === "undefined" || !self.location
    ? { protocol: "", hostname: "", port: "", href: "" }
    : self.location;
}

/**
 * Assemble a url from its parts. `new URL()` cannot be used for this: it has
 * no way to say "host unknown, resolve it later", and it re-encodes
 * credentials that are already encoded.
 * @param {{ protocol?: string, auth?: string, hostname?: string, port?: string, pathname?: string }} parts url parts
 * @returns {string} the url
 */
export function formatUrl(parts) {
  let protocol = parts.protocol || "";

  if (protocol && protocol.slice(-1) !== ":") {
    protocol += ":";
  }

  let auth = parts.auth || "";

  if (auth) {
    auth = encodeURIComponent(auth);
    // The separator between a username and a password is not part of either,
    // so it survives the encoding above.
    auth = auth.replace(/%3A/i, ":");
    auth += "@";
  }

  let host = "";

  if (parts.hostname) {
    // A raw IPv6 address has to be bracketed in a url, and only there: the
    // brackets are not part of the address.
    host =
      auth +
      (parts.hostname.indexOf(":") === -1
        ? parts.hostname
        : `[${parts.hostname}]`);

    if (parts.port) {
      host += `:${parts.port}`;
    }
  }

  let pathname = parts.pathname || "";

  if (pathname && pathname.charAt(0) !== "/") {
    pathname = `/${pathname}`;
  }

  // A `?` or `#` in a path is a query or a fragment to a browser, so a path
  // that contains one has to say it means the character.
  pathname = pathname.replace(
    /[?#]/g,
    /**
     * @param {string} match the character
     * @returns {string} it, encoded
     */
    (match) => encodeURIComponent(match),
  );

  return `${protocol}//${host}${pathname}`;
}

/**
 * The credentials, as one `user:password` string. HTTP basic authentication
 * has no empty username, so a password without one is dropped rather than
 * sent as `:password`.
 * @param {PathSpec} spec what the page was told
 * @returns {string} the credentials, or an empty string
 */
function auth(spec) {
  if (!spec.username) {
    return "";
  }

  return spec.password ? `${spec.username}:${spec.password}` : spec.username;
}

// What each transport connects over. The two do not share a scheme, so the
// one a page was served over says only whether TLS is in play — which of the
// pair that makes it is the transport's to say.
const TRANSPORT_SCHEMES = {
  ws: { plain: "ws:", secure: "wss:" },
  sse: { plain: "http:", secure: "https:" },
};

/**
 * Resolve a path spec into the url to connect to.
 * @param {PathSpec} spec the parts that were given
 * @param {string} fallbackPathname the endpoint's path, when the spec names none
 * @param {("sse" | "ws")=} transport which transport will use the url
 * @returns {string} the url
 */
export default function resolveSocketUrl(spec, fallbackPathname, transport) {
  const location = here();
  const SCHEMES = TRANSPORT_SCHEMES[transport === "ws" ? "ws" : "sse"];
  let { hostname } = spec;

  // The addresses a server listens on to mean "every interface". They are not
  // somewhere a page can connect to, so the page's own host is used — the
  // request that loaded it reached this server, so it is an address that
  // works. `file:` has no hostname to fall back to, which is why the protocol
  // is checked rather than the hostname alone.
  const isEveryInterface =
    hostname === "0.0.0.0" || hostname === "::" || hostname === "[::]";

  if (
    isEveryInterface &&
    location.hostname &&
    location.protocol.indexOf("http") === 0
  ) {
    hostname = location.hostname;
  }

  let given = spec.protocol || location.protocol;

  // `"auto"` is "whatever the page is", and a page served over TLS cannot
  // reach a plaintext endpoint at all — a browser refuses it — so a secure
  // page gets a secure connection whether or not it asked for one.
  if (
    given === "auto:" ||
    given === "auto" ||
    (hostname && isEveryInterface && location.protocol === "https:")
  ) {
    given = location.protocol;
  }

  // Only one thing is read off whatever was given: whether it is the secure
  // one. The scheme itself is the transport's to choose, since the two do not
  // share one — and a protocol that is neither (`file:`, an extension) is not
  // secure, which leaves it on the plain scheme the way it was before.
  const isSecure = given === "https:" || given === "wss:";
  const protocol = SCHEMES[isSecure ? "secure" : "plain"];

  let port = spec.port === undefined ? "" : String(spec.port);

  // `0` is "pick a port", which is a port only the server knows. By the time a
  // page is running it was served from the one that was picked.
  if (!port || port === "0") {
    port = location.port;
  }

  return formatUrl({
    protocol,
    auth: auth(spec),
    hostname: (hostname || location.hostname || "localhost").replace(
      /^\[(.*)\]$/,
      "$1",
    ),
    port,
    pathname:
      spec.pathname === undefined || spec.pathname === ""
        ? fallbackPathname
        : spec.pathname,
  });
}
