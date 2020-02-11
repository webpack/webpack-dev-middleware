import path from 'path';
import { parse } from 'url';

import querystring from 'querystring';

function getPaths(stats, options, url) {
  let outputPath;
  let publicPath;

  if (stats.stats) {
    for (let i = 0; i < stats.stats.length; i++) {
      const { compilation } = stats.stats[i];

      publicPath = options.publicPath
        ? options.publicPath
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
      ? options.publicPath
      : compilation.outputOptions.publicPath
      ? compilation.getPath(compilation.outputOptions.publicPath)
      : '';
  }

  return { outputPath, publicPath };
}

export default function getFilenameFromUrl(context, url, stats) {
  const { options } = context;
  const { outputPath, publicPath } = getPaths(stats, options, url);

  let publicPathObject;

  try {
    publicPathObject = parse(publicPath || '/', false, true);
  } catch (_ignoreError) {
    return false;
  }

  let urlObject;

  try {
    urlObject = parse(url);
  } catch (_ignoreError) {
    return false;
  }

  if (
    // The `publicPath` option has the `protocol` that is not the same as request url's, should fail
    (publicPathObject.protocol !== null &&
      urlObject.protocol !== null &&
      publicPathObject.protocol !== urlObject.protocol) ||
    // The `publicPath` option has the `auth` that is not the same as request url's, should fail
    (publicPathObject.auth !== null &&
      urlObject.auth !== null &&
      publicPathObject.auth !== urlObject.auth) ||
    // The `publicPath` option has the `host` that is not the same as request url's, should fail
    (publicPathObject.host !== null &&
      urlObject.host !== null &&
      publicPathObject.host !== urlObject.host)
  ) {
    return false;
  }

  // The `publicPath` option has the `host` property.
  // The requested url doesn't contain the `host` property.
  // But the `pathname` property of the requested url doesn't start with `pathname` property of `publicPath`.
  if (
    publicPathObject.host &&
    !urlObject.host &&
    !urlObject.pathname.startsWith(publicPathObject.pathname)
  ) {
    return false;
  }

  // publicPath is not in url, so it should fail
  // TODO test
  if (
    publicPath &&
    publicPathObject.host === urlObject.host &&
    url.indexOf(publicPath) !== 0
  ) {
    return false;
  }

  let uri = outputPath;
  let filename;

  // Strip the `pathname` property from the `publicPath` option from the start of requested url
  // `/complex/foo.js` => `foo.js`
  if (urlObject.pathname.startsWith(publicPathObject.pathname)) {
    filename = urlObject.pathname.substr(publicPathObject.pathname.length);
  }

  // Forming the path to the file
  if (filename) {
    uri = path.join(outputPath, querystring.unescape(filename));

    if (!path.isAbsolute(uri)) {
      uri = `/${uri}`;
    }
  }

  return uri;
}
