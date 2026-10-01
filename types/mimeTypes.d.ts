export = createMimeTypes;
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
declare function createMimeTypes(
  extra?: Record<string, string> | undefined,
): MimeTypes;
declare namespace createMimeTypes {
  export { createMimeTypes, mimeScore, MimeTypes, MimeDbEntry };
}
/**
 * How official a media type is. The higher the score the more it is preferred
 * where two types claim the same extension.
 * @param {string} mimeType the media type
 * @param {string=} source where `mime-db` got it from
 * @returns {number} the score
 */
declare function mimeScore(
  mimeType: string,
  source?: string | undefined,
): number;
type MimeTypes = {
  /**
   * the media type an extension, a `.extension`, or a path resolves to
   */
  lookup: (file: string) => string | false;
  /**
   * the charset a media type is served as
   */
  charset: (type: string) => string | false;
  /**
   * a `Content-Type` value for a media type or an extension
   */
  contentType: (str: string) => string | false;
};
type MimeDbEntry = {
  source?: string;
  charset?: string;
  compressible?: boolean;
  extensions?: readonly string[];
};
