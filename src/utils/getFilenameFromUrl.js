import path from 'path';
import { parse } from 'url';
import querystring from 'querystring';

import mem from 'mem';

function getPaths(stats, options) {
  const childStats = Array.isArray(stats.stats) ? stats.stats : [stats];
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

export default function getFilenameFromUrl(context, url) {
  const { options } = context;
  const paths = getPaths(context.stats, options);
  const memoizedParse = mem(parse);

  let filename;
  let urlObject;

  try {
    // The `url` property of the `request` is contains only  `pathname`, `search` and `hash`
    urlObject = memoizedParse(url, false, true);
  } catch (_ignoreError) {
    return filename;
  }

  for (const { publicPath, outputPath } of paths) {
    let publicPathObject;

    try {
      publicPathObject = memoizedParse(publicPath || '/', false, true);
    } catch (_ignoreError) {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (
      urlObject.pathname &&
      urlObject.pathname.startsWith(publicPathObject.pathname)
    ) {
      filename = outputPath;

      // Strip the `pathname` property from the `publicPath` option from the start of requested url
      // `/complex/foo.js` => `foo.js`
      const pathname = urlObject.pathname.substr(
        publicPathObject.pathname.length
      );

      if (pathname) {
        filename = path.join(outputPath, querystring.unescape(pathname));
      }

      let fsStats;

      try {
        fsStats = context.outputFileSystem.statSync(filename);
      } catch (_ignoreError) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (fsStats.isFile()) {
        break;
      } else if (
        fsStats.isDirectory() &&
        (typeof options.index === 'undefined' || options.index)
      ) {
        const indexValue =
          typeof options.index === 'undefined' ||
          typeof options.index === 'boolean'
            ? 'index.html'
            : options.index;

        filename = path.join(filename, indexValue);

        try {
          fsStats = context.outputFileSystem.statSync(filename);
        } catch (__ignoreError) {
          // eslint-disable-next-line no-continue
          continue;
        }

        if (fsStats.isFile()) {
          break;
        }
      }
    }
  }

  return filename;
}
