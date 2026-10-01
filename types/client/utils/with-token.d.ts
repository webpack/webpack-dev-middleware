/**
 * Put the token on an endpoint url.
 *
 * On the url because neither `EventSource` nor `WebSocket` lets a page set a
 * request header, so there is nowhere else to put it.
 *
 * Set rather than appended: a path that already carries a `token` would end up
 * with two, and the endpoint reads the first — so the one passed here would be
 * the one ignored. Taken apart by hand rather than through `URL`, which would
 * need a base and would turn a relative path into an absolute one; this keeps
 * whatever shape it was given, absolute url, rooted path or relative.
 * @param {string} path the endpoint, which may already carry a query, a fragment, or both
 * @param {string | undefined} token the token, when the endpoint requires one
 * @returns {string} the endpoint to connect to
 */
export default function withToken(
  path: string,
  token: string | undefined,
): string;
