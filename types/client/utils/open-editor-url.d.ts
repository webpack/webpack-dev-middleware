/**
 * The url the overlay asks to open a file reference.
 *
 * The token goes along only to a path on this page's own server — rooted,
 * and neither protocol-relative nor what a browser reads as that, `/\` —
 * which is where the hot endpoint that handed it over lives. An absolute url
 * can name any server, and the token is not that server's to have.
 * @param {string} endpoint the `openEditorEndpoint`
 * @param {string} reference the `file:line:column` reference clicked
 * @param {string=} token the token the client was given, when it was given one
 * @returns {string} the url to fetch
 */
export default function openEditorUrl(
  endpoint: string,
  reference: string,
  token?: string | undefined,
): string;
