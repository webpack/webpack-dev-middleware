import src from "../src";
import cjs from "../src/cjs";

describe("cjs", () => {
  it("should work", () => {
    expect(cjs).toEqual(src);
  });
});
