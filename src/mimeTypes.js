// Extension to media type, straight from `mime-db`.
//
// This was `mime-types`, which is `mime-db` plus the table and the scoring
// below. Two reasons to own them instead:
//
//   * `mime-db` is what webpack already depends on, so a webpack project has
//     it installed either way. Going through `mime-types` added a package to
//     every install and a second version range over the same data.
//   * the `mimeTypes` option used to be applied by assigning to the shared
//     `mime-types` module's own table, which is process-wide: two middleware
//     instances accumulated into one map rather than keeping their own, and
//     anything else in the process using `mime-types` inherited whatever a
//     middleware had registered. A table per instance is what the option
//     always meant.
//
// The scoring is `jshttp/mime-types`' own, so an extension resolves to exactly
// what it did before — `test/mimeTypes.test.js` holds that to every extension
// in `mime-db`.

const path = require("node:path");

// Described here rather than imported from `@types/mime-db`, so the
// declarations this package publishes do not ask consumers for a package only
// its own build needs.
/** @typedef {{ source?: string, charset?: string, compressible?: boolean, extensions?: readonly string[] }} MimeDbEntry */

// Facets, from RFC 6838 section 3: a vendor or personal subtype is less
// official than a plain one.
/** @type {Record<string, number>} */
const FACET_SCORES = {
  "prs.": 100,
  "x-": 200,
  "x.": 300,
  "vnd.": 400,
  default: 900,
};

/** @type {Record<string, number>} */
const SOURCE_SCORES = {
  nginx: 10,
  apache: 20,
  iana: 40,
  // What `mime-db` added itself.
  default: 30,
};

/** @type {Record<string, number>} */
const TYPE_SCORES = {
  // `application/xml` over `text/xml`, `application/rtf` over `text/rtf`.
  application: 1,
  // `font/woff` over `application/font-woff`.
  font: 2,
  // `video/mp4` over `audio/mp4` over `application/mp4`, per RFC 4337.
  audio: 2,
  video: 3,
  default: 0,
};

const EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:[;\s]|$)/;
const TEXT_TYPE_REGEXP = /^text\//i;

/**
 * How official a media type is. The higher the score the more it is preferred
 * where two types claim the same extension.
 * @param {string} mimeType the media type
 * @param {string=} source where `mime-db` got it from
 * @returns {number} the score
 */
function mimeScore(mimeType, source = "default") {
  if (mimeType === "application/octet-stream") {
    return 0;
  }

  const [type, subtype] = mimeType.split("/");
  const facet = subtype.replace(/([.]|x-).*/, "$1");

  // All else equal, the shorter type wins.
  return (
    (FACET_SCORES[facet] || FACET_SCORES.default) +
    (SOURCE_SCORES[source] || SOURCE_SCORES.default) +
    (TYPE_SCORES[type] || TYPE_SCORES.default) +
    (1 - mimeType.length / 100)
  );
}

/** @type {{ db: Record<string, MimeDbEntry>, types: Record<string, string> } | undefined} */
let tables;

/**
 * The extension table, built once and only when something asks for a type.
 * `mime-db` is a megabyte of JSON, and a build that never serves a file over
 * HTTP — `writeToDisk` on its own, a plugin run — should not pay to parse it.
 * @returns {{ db: Record<string, MimeDbEntry>, types: Record<string, string> }} the database and the extension table
 */
function getTables() {
  if (tables) {
    return tables;
  }

  /** @type {Record<string, MimeDbEntry>} */
  const db = require("mime-db");

  /** @type {Record<string, string>} */
  const types = Object.create(null);

  for (const type of Object.keys(db)) {
    const { extensions } = db[type];

    if (!extensions || extensions.length === 0) {
      continue;
    }

    for (const extension of extensions) {
      const current = types[extension];

      types[extension] =
        (current ? mimeScore(current, db[current].source) : 0) >
        mimeScore(type, db[type].source)
          ? current
          : type;
    }
  }

  tables = { db, types };

  return tables;
}

/**
 * @typedef {object} MimeTypes
 * @property {(file: string) => string | false} lookup the media type an extension, a `.extension`, or a path resolves to
 * @property {(type: string) => string | false} charset the charset a media type is served as
 * @property {(str: string) => string | false} contentType a `Content-Type` value for a media type or an extension
 */

/**
 * The lookup an instance uses, with the `mimeTypes` option over the top of the
 * known extensions rather than written into them.
 * @param {Record<string, string>=} extra extension to media type, from the `mimeTypes` option
 * @returns {MimeTypes} the lookup
 */
function createMimeTypes(extra) {
  // Copied, not held: the option used to be spread into a table once, so the
  // object a caller passed stopped mattering the moment the middleware was
  // built, and two instances given the same object could not reach each
  // other through it. A null prototype so `constructor` and `toString` are
  // not extensions anything resolves to.
  const registered = extra
    ? Object.assign(Object.create(null), extra)
    : undefined;

  /**
   * The media type an extension, a `.extension`, or a whole path resolves to.
   * @param {string} file extension, `.extension`, or path
   * @returns {string | false} the media type, or false when none is known
   */
  const lookup = (file) => {
    if (!file || typeof file !== "string") {
      return false;
    }

    // The `x.` prefix makes one expression cover all three spellings:
    // `js`, `.js` and `/a/b.js`.
    const extension = path.extname(`x.${file}`).toLowerCase().slice(1);

    if (!extension) {
      return false;
    }

    // The option first: registering an extension is how it is overridden.
    if (registered && registered[extension] !== undefined) {
      return registered[extension];
    }

    return getTables().types[extension] || false;
  };

  /**
   * The charset a media type is served as, where one is known.
   * @param {string} type the media type
   * @returns {string | false} the charset, or false
   */
  const charset = (type) => {
    if (!type || typeof type !== "string") {
      return false;
    }

    const match = EXTRACT_TYPE_REGEXP.exec(type);
    const entry = match && getTables().db[match[1].toLowerCase()];

    if (entry && entry.charset) {
      return entry.charset;
    }

    // Text is UTF-8 unless `mime-db` says otherwise. Spelled the way
    // `mime-db` spells it, since this is returned to callers and not only
    // used to build a header.
    if (match && TEXT_TYPE_REGEXP.test(match[1])) {
      // eslint-disable-next-line unicorn/text-encoding-identifier-case
      return "UTF-8";
    }

    return false;
  };

  /**
   * A `Content-Type` value for a media type, an extension, or a path — the
   * type with its charset where there is one.
   * @param {string} str media type, extension, `.extension`, or path
   * @returns {string | false} the header value, or false when no type is known
   */
  const contentType = (str) => {
    if (!str || typeof str !== "string") {
      return false;
    }

    const type = str.includes("/") ? str : lookup(str);

    if (!type) {
      return false;
    }

    if (type.includes("charset")) {
      return type;
    }

    const found = charset(type);

    return found ? `${type}; charset=${found.toLowerCase()}` : type;
  };

  return { charset, contentType, lookup };
}

module.exports = createMimeTypes;
module.exports.createMimeTypes = createMimeTypes;
module.exports.mimeScore = mimeScore;
