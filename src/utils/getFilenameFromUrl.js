const path = require("node:path");
const querystring = require("node:querystring");

const getPaths = require("./getPaths");
const memorize = require("./memorize");

/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */

/**
 * @param {string} input input
 * @returns {string} unescape input
 */
function decode(input) {
  return querystring.unescape(input);
}

const memoizedParse = memorize((url) => {
  const urlObject = new URL(url, "http://localhost");

  // We can't change pathname in URL object directly because don't decode correctly
  return { ...urlObject, pathname: decode(urlObject.pathname) };
}, undefined);

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * @typedef {object} Extra
 * @property {import("fs").Stats} stats stats
 * @property {boolean=} immutable true when immutable, otherwise false
 */

/**
 * decodeURIComponent.
 *
 * Allows V8 to only deoptimize this fn instead of all of send().
 * @param {string} input
 * @returns {string}
 */

class FilenameError extends Error {
  /**
   * @param {string} message message
   * @param {number=} code error code
   */
  constructor(message, code) {
    super(message);
    this.name = "FilenameError";
    this.code = code;
  }
}

// TODO fix redirect logic when `/` at the end, like https://github.com/pillarjs/send/blob/master/index.js#L586
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").FilledContext<Request, Response>} context context
 * @param {string} url url
 * @returns {{ filename: string, extra: Extra } | undefined} result of get filename from url
 */
function getFilenameFromUrl(context, url) {
  /** @type {URL} */
  let urlObject;

  /** @type {string | undefined} */
  let foundFilename;

  try {
    // The `url` property of the `request` is contains only  `pathname`, `search` and `hash`
    urlObject = memoizedParse(url);
  } catch {
    return;
  }

  const { options } = context;
  const paths = getPaths(context);

  /** @type {Extra} */
  const extra = {};

  for (const { publicPath, outputPath, assetsInfo } of paths) {
    /** @type {string | undefined} */
    let filename;
    /** @type {URL} */
    let publicPathObject;

    try {
      publicPathObject = memoizedParse(
        publicPath !== "auto" && publicPath ? publicPath : "/",
      );
    } catch {
      continue;
    }

    const { pathname } = urlObject;
    const { pathname: publicPathPathname } = publicPathObject;

    if (
      pathname &&
      publicPathPathname &&
      pathname.startsWith(publicPathPathname)
    ) {
      // Null byte(s)
      if (pathname.includes("\0")) {
        throw new FilenameError("Bad Request", 400);
      }

      // ".." is malicious
      if (UP_PATH_REGEXP.test(path.normalize(`./${pathname}`))) {
        throw new FilenameError("Forbidden", 403);
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
        extra.stats = context.outputFileSystem.statSync(filename);
      } catch {
        continue;
      }

      if (extra.stats.isFile()) {
        foundFilename = filename;

        // Rspack does not yet support `assetsInfo`, so we need to check if `assetsInfo` exists here
        if (assetsInfo) {
          const assetInfo = assetsInfo.get(
            pathname.slice(publicPathPathname.length),
          );

          extra.immutable = assetInfo ? assetInfo.immutable : false;
        }

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
          extra.stats = context.outputFileSystem.statSync(filename);
        } catch {
          continue;
        }

        if (extra.stats.isFile()) {
          foundFilename = filename;

          break;
        }
      }
    }
  }

  if (!foundFilename) {
    return;
  }

  return { filename: foundFilename, extra };
}

module.exports = getFilenameFromUrl;
module.exports.FilenameError = FilenameError;
