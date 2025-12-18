export = memorize;
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
declare function memorize<T>(
  fn: FunctionReturning<T>,
  {
    cache,
  }?:
    | (
        | {
            cache?: Map<
              string,
              {
                data: T;
              }
            >;
          }
        | undefined
      )
    | undefined,
  callback?: ((value: T) => T) | undefined,
): FunctionReturning<T>;
declare namespace memorize {
  export { FunctionReturning, EXPECTED_ANY };
}
type FunctionReturning<T> = (...args: EXPECTED_ANY) => T;
type EXPECTED_ANY = import("../index").EXPECTED_ANY;
