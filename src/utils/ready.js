// eslint-disable-next-line consistent-return
export default function ready(context, fn, req) {
  if (context.state) {
    return fn(context.stats);
  }

  const name = req.url || fn.name;

  context.log.info(`wait until bundle finished${name ? `: ${name}` : ''}`);

  context.callbacks.push(fn);
}
