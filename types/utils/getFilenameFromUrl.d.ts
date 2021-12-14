/** @typedef {import("../index.js").Context} Context */
/**
 * @param {Context} context
 * @param {string} url
 * @returns {string | undefined}
 */
export default function getFilenameFromUrl(
  context: Context,
  url: string
): string | undefined;
export type Context = import("../index.js").Context;
