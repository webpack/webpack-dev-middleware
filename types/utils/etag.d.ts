export = etag;
/**
 * Create a simple ETag.
 *
 * @param {Buffer | ReadStream | Stats} entity
 * @return {Promise<{ hash: string, buffer?: Buffer }>}
 */
declare function etag(entity: Buffer | ReadStream | Stats): Promise<{
  hash: string;
  buffer?: Buffer;
}>;
declare namespace etag {
  export { Stats, ReadStream };
}
type ReadStream = import("fs").ReadStream;
type Stats = import("fs").Stats;
