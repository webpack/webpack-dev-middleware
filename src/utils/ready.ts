import type express from 'express';
import type webpack from 'webpack';
import type { MultiStats, WebpackDevMiddlewareContext } from '../types';

export default function ready(
  context: WebpackDevMiddlewareContext,
  callback: (stats: webpack.Stats | MultiStats) => void,
  req?: express.Request
): void {
  if (context.state) {
    callback(context.stats!);
    return;
  }

  const name = (req && req.url) || callback.name;

  context.logger.info(`wait until bundle finished${name ? `: ${name}` : ''}`);

  context.callbacks.push(callback);
}
