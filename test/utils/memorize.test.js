import { memorize } from "../../src/utils.js";

describe("memorize", () => {
  it("should call the function once per key", () => {
    const fn = jest.fn((value) => `${value}!`);
    const memoized = memorize(fn);

    expect(memoized("a")).toBe("a!");
    expect(memoized("a")).toBe("a!");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should apply the callback to the value it stores", () => {
    const memoized = memorize(
      (value) => value,
      undefined,
      (value) => `${value}-mapped`,
    );

    expect(memoized("a")).toBe("a-mapped");
    expect(memoized("a")).toBe("a-mapped");
  });

  it("should not grow past the cache limit", () => {
    const cache = new Map();
    const memoized = memorize((value) => value, { cache, maxSize: 3 });

    for (let i = 0; i < 100; i++) {
      memoized(`key-${i}`);
    }

    // Without a limit this cache would hold every key the process ever saw;
    // these are keyed by request data, so that grows with traffic.
    expect(cache.size).toBeLessThanOrEqual(3);
  });

  it("should evict the least recently used key", () => {
    const fn = jest.fn((value) => value);
    const cache = new Map();
    const memoized = memorize(fn, { cache, maxSize: 2 });

    memoized("a");
    memoized("b");
    // Reading "a" makes "b" the least recently used one.
    memoized("a");
    memoized("c");

    expect([...cache.keys()]).toEqual(["a", "c"]);

    // "a" survived, so it is still a hit; "b" was evicted and recomputes.
    fn.mockClear();
    memoized("a");
    expect(fn).not.toHaveBeenCalled();

    memoized("b");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
