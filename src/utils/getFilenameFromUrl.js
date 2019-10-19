import path from 'path';
import { parse } from 'url';

import querystring from 'querystring';

// support for multi-compiler configuration
// see: https://github.com/webpack/webpack-dev-server/issues/641
function getPaths(publicPath, compiler, url) {
  const compilers = compiler && compiler.compilers;

  if (Array.isArray(compilers)) {
    let compilerPublicPath;

    // the path portion of compilerPublicPath
    let compilerPublicPathBase;

    for (let i = 0; i < compilers.length; i++) {
      compilerPublicPath =
        compilers[i].options &&
        compilers[i].options.output &&
        compilers[i].options.output.publicPath;

      if (compilerPublicPath) {
        compilerPublicPathBase =
          compilerPublicPath.indexOf('/') === 0
            ? compilerPublicPath // eslint-disable-next-line
            : // handle the case where compilerPublicPath is a URL with hostname
              parse(compilerPublicPath).pathname;

        // check the url vs the path part of the compilerPublicPath
        if (url.indexOf(compilerPublicPathBase) === 0) {
          return {
            publicPath: compilerPublicPath,
            outputPath: compilers[i].outputPath,
          };
        }
      }
    }
  }

  return {
    publicPath,
    outputPath: compiler.outputPath,
  };
}

export default function getFilenameFromUrl(pubPath, compiler, url) {
  const { outputPath, publicPath } = getPaths(pubPath, compiler, url);
  // localPrefix is the folder our bundle should be in
  const localPrefix = parse(publicPath || '/', false, true);
  const urlObject = parse(url);
  let filename;

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

  /* istanbul ignore if */
  if (process.platform === 'win32') {
    // Path Handling for Microsoft Windows
    if (filename) {
      uri = path.posix.join(outputPath || '', querystring.unescape(filename));

      if (!path.win32.isAbsolute(uri)) {
        uri = `/${uri}`;
      }
    }

    return uri;
  }

  // Path Handling for all other operating systems
  if (filename) {
    uri = path.posix.join(outputPath || '', filename);

    if (!path.posix.isAbsolute(uri)) {
      uri = `/${uri}`;
    }
  }

  // if no matches, use outputPath as filename
  return querystring.unescape(uri);
}
