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
  // localPrefix is the folder our bundle should be in
  // TODO catch error
  const localPrefix = parse(publicPath || '/', false, true);
  const urlObject = parse(url);
  const hostNameIsTheSame = localPrefix.hostname === urlObject.hostname;

  // publicPath has the hostname that is not the same as request url's, should fail
  if (
    localPrefix.hostname !== null &&
    urlObject.hostname !== null &&
    !hostNameIsTheSame
  ) {
    return false;
  }

  // publicPath is not in url, so it should fail
  if (publicPath && hostNameIsTheSame && url.indexOf(publicPath) !== 0) {
    return false;
  }

  let filename;

  // strip localPrefix from the start of url
  if (urlObject.pathname.indexOf(localPrefix.pathname) === 0) {
    filename = urlObject.pathname.substr(localPrefix.pathname.length);
  }

  if (
    !urlObject.hostname &&
    localPrefix.hostname &&
    url.indexOf(localPrefix.path) !== 0
  ) {
    return false;
  }

  let uri = outputPath;

  // Path Handling for all other operating systems
  if (filename) {
    uri = path.posix.join(outputPath, querystring.unescape(filename));

    if (process.platform === 'win32') {
      if (!path.win32.isAbsolute(uri)) {
        uri = `/${uri}`;
      }
    } else if (!path.posix.isAbsolute(uri)) {
      uri = `/${uri}`;
    }
  }

  return uri;
}
