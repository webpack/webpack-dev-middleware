import type fs from 'fs';
import path from 'path';
import { parse, UrlWithStringQuery } from 'url';
import querystring from 'querystring';
import mem from 'mem';
import getPaths from './getPaths';
import type { WebpackDevMiddlewareContext } from '../types';

const memoizedParse = mem(parse);

export default function getFilenameFromUrl(
  context: WebpackDevMiddlewareContext,
  url: string
): string | undefined {
  const { options } = context;
  const paths = getPaths(context);

  let filename: string | undefined;
  let urlObject: UrlWithStringQuery;

  try {
    // The `url` property of the `request` is contains only  `pathname`, `search` and `hash`
    urlObject = memoizedParse(url, false, true);
  } catch (_ignoreError) {
    return filename;
  }

  for (const { publicPath, outputPath } of paths) {
    let publicPathObject: UrlWithStringQuery;

    try {
      publicPathObject = memoizedParse(
        publicPath !== 'auto' && publicPath ? publicPath : '/',
        false,
        true
      );
    } catch (_ignoreError) {
      continue;
    }

    if (
      urlObject.pathname &&
      urlObject.pathname.startsWith(publicPathObject.pathname!)
    ) {
      filename = outputPath;

      // Strip the `pathname` property from the `publicPath` option from the start of requested url
      // `/complex/foo.js` => `foo.js`
      const pathname = urlObject.pathname.substr(
        publicPathObject.pathname!.length
      );

      if (pathname) {
        filename = path.join(outputPath, querystring.unescape(pathname));
      }

      let fsStats: fs.Stats;

      try {
        fsStats = context.outputFileSystem.statSync(filename);
      } catch (_ignoreError) {
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
