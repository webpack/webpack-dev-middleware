import path from 'path';
import { parse } from 'url';
import querystring from 'querystring';

import mem from 'mem';

function getPaths(stats, options) {
  const childStats = stats.stats ? stats.stats : [stats];
  const publicPaths = [];

  for (const { compilation } of childStats) {
    // The `output.path` is always present and always absolute
    const outputPath = compilation.getPath(compilation.outputOptions.path);
    const publicPath = options.publicPath
      ? compilation.getPath(options.publicPath)
      : compilation.outputOptions.publicPath
      ? compilation.getPath(compilation.outputOptions.publicPath)
      : '';

    publicPaths.push({ outputPath, publicPath });
  }

  return publicPaths;
}

const memoizedParse = mem(parse);

export default (context, url, stats) => {
  const { options } = context;
  const paths = getPaths(stats, options);

  let urlObject;

  const pathToFiles = [];

  try {
    // The `url` property of the `request` is contains only  `pathname`, `search` and `hash`
    urlObject = memoizedParse(url, false, true);
  } catch (_ignoreError) {
    // eslint-disable-next-line no-undefined
    return pathToFiles;
  }

  for (const { publicPath, outputPath } of paths) {
    let publicPathObject;

    try {
      publicPathObject = memoizedParse(publicPath || '/', false, true);
    } catch (_ignoreError) {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (urlObject.pathname.startsWith(publicPathObject.pathname)) {
      let pathToFile = outputPath;

      // Strip the `pathname` property from the `publicPath` option from the start of requested url
      // `/complex/foo.js` => `foo.js`
      const filename = urlObject.pathname.substr(
        publicPathObject.pathname.length
      );

      // Forming the path to the file
      if (filename) {
        pathToFile = path.join(outputPath, querystring.unescape(filename));
      }

      pathToFiles.push(pathToFile);
    }
  }

  return pathToFiles;
};
