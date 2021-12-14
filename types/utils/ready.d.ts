/** @typedef {import("../index.js").Context} Context */
/** @typedef {import("../index.js").Request} Request */
/**
 * @param {Context} context
 * @param {Function} callback
 * @param {Request} [req]
 * @returns {void}
 */
export default function ready(
  context: Context,
  callback: Function,
  req?: import("../index.js").Request | undefined
): void;
export type Context = import("../index.js").Context;
export type Request = import("../index.js").Request;
