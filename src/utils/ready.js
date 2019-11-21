// eslint-disable-next-line consistent-return
export default function ready(context, callback, req) {
  if (context.state) {
    return callback(context.stats);
  }

  const name = req.url || callback.name;

  context.logger.info(`wait until bundle finished${name ? `: ${name}` : ''}`);

  context.callbacks.push(callback);
}
