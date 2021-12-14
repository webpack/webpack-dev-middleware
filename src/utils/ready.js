/** @typedef {import("../index.js").Context} Context */
/** @typedef {import("../index.js").Request} Request */

/**
 * @param {Context} context
 * @param {Function} callback
 * @param {Request} [req]
 * @returns {void}
 */
export default function ready(context, callback, req) {
  if (context.state) {
    callback(context.stats);
    
    return;
  }

  const name = (req && req.url) || callback.name;

  context.logger.info(`wait until bundle finished${name ? `: ${name}` : ""}`);

  context.callbacks.push(callback);
}
