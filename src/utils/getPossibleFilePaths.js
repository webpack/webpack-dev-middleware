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

    let pathToFile = outputPath;

    if (
      urlObject.pathname &&
      urlObject.pathname.startsWith(publicPathObject.pathname)
    ) {
      // Strip the `pathname` property from the `publicPath` option from the start of requested url
      // `/complex/foo.js` => `foo.js`
      const filename = urlObject.pathname.substr(
        publicPathObject.pathname.length
      );

      if (filename) {
        pathToFile = path.join(outputPath, querystring.unescape(filename));
      }

      let fsStats;

      try {
        fsStats = context.outputFileSystem.statSync(pathToFile);
      } catch (_ignoreError) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (fsStats.isFile()) {
        pathToFiles.push(pathToFile);
      } else if (
        fsStats.isDirectory() &&
        (typeof options.index === 'undefined' || options.index)
      ) {
        const indexValue =
          typeof options.index === 'undefined' ||
          typeof options.index === 'boolean'
            ? 'index.html'
            : options.index;

        pathToFile = path.join(pathToFile, indexValue);

        try {
          fsStats = context.outputFileSystem.statSync(pathToFile);
        } catch (__ignoreError) {
          // eslint-disable-next-line no-continue
          continue;
        }

        if (fsStats.isFile()) {
          pathToFiles.push(pathToFile);
        }
      }
    }
  }

  return pathToFiles;
};
