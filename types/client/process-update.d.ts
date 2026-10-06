/**
 * @param {string} hash latest hash from the SSE payload
 * @param {{ reload?: boolean, runtimeLeftOut?: boolean }} options client options
 * @param {string=} name compilation name the payload belongs to
 */
export default function applyUpdate(
  hash: string,
  options: {
    reload?: boolean;
    runtimeLeftOut?: boolean;
  },
  name?: string | undefined,
): void;
