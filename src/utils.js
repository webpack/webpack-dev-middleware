const crypto = require("node:crypto");

const matchHtmlRegExp = /["'&<>]/;

/**
 * @param {string} string raw HTML
 * @returns {string} escaped HTML
 */
function escapeHtml(string) {
  const str = `${string}`;
  const match = matchHtmlRegExp.exec(str);

  if (!match) {
    return str;
  }

  let escape;
  let html = "";
  let index = 0;
  let lastIndex = 0;

  for ({ index } = match; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      // "
      case 34:
        escape = "&quot;";
        break;
      // &
      case 38:
        escape = "&amp;";
        break;
      // '
      case 39:
        escape = "&#39;";
        break;
      // <
      case 60:
        escape = "&lt;";
        break;
      // >
      case 62:
        escape = "&gt;";
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      // eslint-disable-next-line unicorn/prefer-string-slice
      html += str.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  // eslint-disable-next-line unicorn/prefer-string-slice
  return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
}

/** @typedef {import("fs").Stats} Stats */
/** @typedef {import("fs").ReadStream} ReadStream */

/**
 * Generate a tag for a stat.
 * @param {Stats} stats stats
 * @returns {{ hash: string, buffer?: Buffer }} etag
 */
function statTag(stats) {
  const mtime = stats.mtime.getTime().toString(16);
  const size = stats.size.toString(16);

  return { hash: `W/"${size}-${mtime}"` };
}

/**
 * Generate an entity tag.
 * @param {Buffer | ReadStream} entity entity
 * @returns {Promise<{ hash: string, buffer?: Buffer }>} etag
 */
async function entityTag(entity) {
  const sha1 = crypto.createHash("sha1");

  if (!Buffer.isBuffer(entity)) {
    let byteLength = 0;

    /** @type {Buffer[]} */
    const buffers = [];

    await new Promise((resolve, reject) => {
      entity
        .on("data", (chunk) => {
          sha1.update(chunk);
          buffers.push(/** @type {Buffer} */ (chunk));
          byteLength += /** @type {Buffer} */ (chunk).byteLength;
        })
        .on("end", () => {
          resolve(sha1);
        })
        .on("error", reject);
    });

    return {
      buffer: Buffer.concat(buffers),
      hash: `"${byteLength.toString(16)}-${sha1.digest("base64").slice(0, 27)}"`,
    };
  }

  if (entity.byteLength === 0) {
    // Fast-path empty
    return { hash: '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"' };
  }

  // Compute hash of entity
  const hash = sha1.update(entity).digest("base64").slice(0, 27);

  // Compute length of entity
  const { byteLength } = entity;

  return { hash: `"${byteLength.toString(16)}-${hash}"` };
}

/**
 * Create a simple ETag.
 * @param {Buffer | ReadStream | Stats} entity entity
 * @returns {Promise<{ hash: string, buffer?: Buffer }>} etag
 */
async function etag(entity) {
  const isStrong =
    Buffer.isBuffer(entity) ||
    typeof (/** @type {ReadStream} */ (entity).pipe) === "function";

  return isStrong
    ? entityTag(/** @type {Buffer | ReadStream} */ (entity))
    : statTag(/** @type {import("fs").Stats} */ (entity));
}

/** @typedef {import("./index").EXPECTED_ANY} EXPECTED_ANY */

const cacheStore = new WeakMap();

/**
 * @template T
 * @typedef {(...args: EXPECTED_ANY) => T} FunctionReturning
 */

/**
 * @template T
 * @param {FunctionReturning<T>} fn memorized function
 * @param {({ cache?: Map<string, { data: T }> } | undefined)=} cache cache
 * @param {((value: T) => T)=} callback callback
 * @returns {FunctionReturning<T>} new function
 */
function memorize(fn, { cache = new Map() } = {}, callback = undefined) {
  /**
   * @param {EXPECTED_ANY[]} arguments_ args
   * @returns {EXPECTED_ANY} result
   */
  const memoized = (...arguments_) => {
    const [key] = arguments_;
    const cacheItem = cache.get(key);

    if (cacheItem) {
      return cacheItem.data;
    }

    // @ts-expect-error
    let result = fn.apply(this, arguments_);

    if (callback) {
      result = callback(result);
    }

    cache.set(key, {
      data: result,
    });

    return result;
  };

  cacheStore.set(memoized, cache);

  return memoized;
}

/**
 * Parse a HTTP token list.
 * @param {string} str str
 * @returns {string[]} tokens
 */
function parseTokenList(str) {
  let end = 0;
  let start = 0;

  const list = [];

  // gather tokens
  for (let i = 0, len = str.length; i < len; i++) {
    switch (str.charCodeAt(i)) {
      case 0x20 /*   */:
        if (start === end) {
          end = i + 1;
          start = end;
        }
        break;
      case 0x2c /* , */:
        if (start !== end) {
          list.push(str.slice(start, end));
        }
        end = i + 1;
        start = end;
        break;
      default:
        end = i + 1;
        break;
    }
  }

  // final token
  if (start !== end) {
    list.push(str.slice(start, end));
  }

  return list;
}

module.exports = {
  escapeHtml,
  etag,
  memorize,
  parseTokenList,
};
