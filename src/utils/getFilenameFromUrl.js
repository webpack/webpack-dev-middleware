const path = require("path");
const { parse } = require("url");
const querystring = require("querystring");

const getPaths = require("./getPaths");

/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */

const cacheStore = new WeakMap();

/**
 * @param {Function} fn
 * @param {{ cache?: Map<any, any> }} [cache]
 * @returns {any}
 */
// @ts-ignore
const mem = (fn, { cache = new Map() } = {}) => {
  /**
   * @param {any} arguments_
   * @return {any}
   */
  const memoized = (...arguments_) => {
    const [key] = arguments_;
    const cacheItem = cache.get(key);

    if (cacheItem) {
      return cacheItem.data;
    }

    const result = fn.apply(this, arguments_);

    cache.set(key, {
      data: result,
    });

    return result;
  };

  cacheStore.set(memoized, cache);

  return memoized;
};
const memoizedParse = mem(parse);

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * @typedef {Object} Extra
 * @property {import("fs").Stats=} stats
 * @property {number=} errorCode
 */

/**
 * decodeURIComponent.
 *
 * Allows V8 to only deoptimize this fn instead of all of send().
 *
 * @param {string} input
 * @returns {string}
 */

function decode(input) {
  return querystring.unescape(input);
}

// TODO refactor me in the next major release, this function should return `{ filename, stats, error }`
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").Context<Request, Response>} context
 * @param {string} url
 * @param {Extra=} extra
 * @returns {string | undefined}
 */
function getFilenameFromUrl(context, url, extra = {}) {
  const { options } = context;
  const paths = getPaths(context);

  let foundFilename;
  let urlObject;

  try {
    // The `url` property of the `request` is contains only  `pathname`, `search` and `hash`
    urlObject = memoizedParse(url, false, true);
  } catch (_ignoreError) {
    return;
  }

  for (const { publicPath, outputPath } of paths) {
    let filename;
    let publicPathObject;

    try {
      publicPathObject = memoizedParse(
        publicPath !== "auto" && publicPath ? publicPath : "/",
        false,
        true,
      );
    } catch (_ignoreError) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const pathname = decode(urlObject.pathname);
    const publicPathPathname = decode(publicPathObject.pathname);

    if (pathname && pathname.startsWith(publicPathPathname)) {
      // Null byte(s)
      if (pathname.includes("\0")) {
        // eslint-disable-next-line no-param-reassign
        extra.errorCode = 400;

        return;
      }

      // ".." is malicious
      if (UP_PATH_REGEXP.test(path.normalize(`./${pathname}`))) {
        // eslint-disable-next-line no-param-reassign
        extra.errorCode = 403;

        return;
      }

      // Strip the `pathname` property from the `publicPath` option from the start of requested url
      // `/complex/foo.js` => `foo.js`
      // and add outputPath
      // `foo.js` => `/home/user/my-project/dist/foo.js`
      filename = path.join(
        outputPath,
        pathname.slice(publicPathPathname.length),
      );

      try {
        // eslint-disable-next-line no-param-reassign
        extra.stats =
          /** @type {import("fs").statSync} */
          (context.outputFileSystem.statSync)(filename);
      } catch (_ignoreError) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (extra.stats.isFile()) {
        foundFilename = filename;

        break;
      } else if (
        extra.stats.isDirectory() &&
        (typeof options.index === "undefined" || options.index)
      ) {
        const indexValue =
          typeof options.index === "undefined" ||
          typeof options.index === "boolean"
            ? "index.html"
            : options.index;

        filename = path.join(filename, indexValue);

        try {
          extra.stats =
            /** @type {import("fs").statSync} */
            (context.outputFileSystem.statSync)(filename);
        } catch (__ignoreError) {
          // eslint-disable-next-line no-continue
          continue;
        }

        if (extra.stats.isFile()) {
          foundFilename = filename;

          break;
        }
      }
    }
  }

  // eslint-disable-next-line consistent-return
  return foundFilename;
}

module.exports = getFilenameFromUrl;
