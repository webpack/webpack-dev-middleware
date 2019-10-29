// eslint-disable-next-line consistent-return
export default function ready(context, fn, req) {
  if (context.state) {
    return fn(context.stats);
  }

  context.log.info(`wait until bundle finished: ${req.url || fn.name}`);
  context.callbacks.push(fn);
}
