import path from 'path';
import { parse } from 'url';
import querystring from 'querystring';

import mem from 'mem';

function getPaths(stats, options, url) {
  let outputPath;
  let publicPath;

  if (stats.stats) {
    for (let i = 0; i < stats.stats.length; i++) {
      const { compilation } = stats.stats[i];

      publicPath = options.publicPath
        ? compilation.getPath(options.publicPath)
        : compilation.outputOptions.publicPath
        ? compilation.getPath(compilation.outputOptions.publicPath)
        : '';

      if (publicPath) {
        outputPath = compilation.outputOptions.path
          ? compilation.getPath(compilation.outputOptions.path)
          : '';

        // Handle the case where publicPath is a URL with hostname
        // TODO what the fuck ?!
        const publicPathPathname =
          publicPath.indexOf('/') === 0
            ? publicPath
            : parse(publicPath).pathname;

        // Check the url vs the path part of the publicPath
        if (url.indexOf(publicPathPathname) === 0) {
          return { publicPath, outputPath };
        }
      }
    }
  } else {
    const { compilation } = stats;

    outputPath = compilation.outputOptions.path
      ? compilation.getPath(compilation.outputOptions.path)
      : '';
    publicPath = options.publicPath
      ? compilation.getPath(options.publicPath)
      : compilation.outputOptions.publicPath
      ? compilation.getPath(compilation.outputOptions.publicPath)
      : '';
  }

  return { outputPath, publicPath };
}

const memoizedParse = mem(parse);

export default function getFilenameFromUrl(context, url, stats) {
  const { options } = context;
  const { outputPath, publicPath } = getPaths(stats, options, url);

  let publicPathObject;

  try {
    publicPathObject = memoizedParse(publicPath || '/', false, true);
  } catch (_ignoreError) {
    return false;
  }

  let urlObject;

  try {
    // The `url` property of the `request` is contains only  `pathname`, `search` and `hash`
    urlObject = memoizedParse(url, false, true);
  } catch (_ignoreError) {
    return false;
  }

  // The `pathname` property of the requested url doesn't start with `pathname` property of `publicPath`, should fail
  if (!urlObject.pathname.startsWith(publicPathObject.pathname)) {
    return false;
  }

  let uri = outputPath;

  // Strip the `pathname` property from the `publicPath` option from the start of requested url
  // `/complex/foo.js` => `foo.js`
  const filename = urlObject.pathname.substr(publicPathObject.pathname.length);

  // Forming the path to the file
  if (filename) {
    uri = path.join(outputPath, querystring.unescape(filename));
  }

  return uri;
}
