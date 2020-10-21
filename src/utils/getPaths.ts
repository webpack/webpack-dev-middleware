import type webpack from 'webpack';
import type { MultiStats, WebpackDevMiddlewareContext } from '../types';

export default function getPaths(
  context: WebpackDevMiddlewareContext
): Array<{ outputPath: string; publicPath: string }> {
  const { stats, options } = context;
  const childStats = (stats as MultiStats).stats
    ? (stats as MultiStats).stats
    : [stats as webpack.Stats];
  const publicPaths: Array<{ outputPath: string; publicPath: string }> = [];

  for (const { compilation } of childStats) {
    // The `output.path` is always present and always absolute
    const outputPath = compilation.getPath(compilation.outputOptions.path!);
    const publicPath = options.publicPath
      ? compilation.getPath(options.publicPath)
      : compilation.outputOptions.publicPath
      ? compilation.getPath(compilation.outputOptions.publicPath)
      : '';

    publicPaths.push({ outputPath, publicPath });
  }

  return publicPaths;
}
