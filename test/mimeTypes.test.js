import db from "mime-db";
// The dependency this replaced, kept as a development one so the replacement
// can be held to it rather than to a list someone wrote out by hand.
import mimeTypes from "mime-types";

import { createMimeTypes } from "../src/utils";

const mime = createMimeTypes();

// `mime-types` is `mime-db` plus a table and a scoring rule, and the scoring
// is the part with teeth: a dozen types claim `.mp4`, and which one wins
// decides the `Content-Type` a browser is handed. Rather than trust a port of
// it, every extension `mime-db` knows is asked of both.
const EXTENSIONS = [
  ...new Set(
    Object.values(db).flatMap(
      (entry) => /** @type {readonly string[]} */ (entry.extensions) || [],
    ),
  ),
].toSorted();

describe("extension to media type", () => {
  it("knows about as many extensions as the database has", () => {
    // A guard on the guard: a table that came out empty would make every
    // assertion below pass against itself.
    expect(EXTENSIONS.length).toBeGreaterThan(1000);
  });

  it("resolves every extension in the database the way `mime-types` does", () => {
    /** @type {string[]} */
    const different = [];

    for (const extension of EXTENSIONS) {
      const ours = mime.lookup(extension);
      const theirs = mimeTypes.lookup(extension);

      if (ours !== theirs) {
        different.push(`${extension}: ${ours} !== ${theirs}`);
      }
    }

    expect(different).toStrictEqual([]);
  });

  it("builds the same `Content-Type` for every one of them", () => {
    // Where the charset rule lives, which is the half webpack's own copy does
    // not need and so could not be borrowed from.
    /** @type {string[]} */
    const different = [];

    for (const extension of EXTENSIONS) {
      const ours = mime.contentType(extension);
      const theirs = mimeTypes.contentType(extension);

      if (ours !== theirs) {
        different.push(`${extension}: ${ours} !== ${theirs}`);
      }
    }

    expect(different).toStrictEqual([]);
  });

  it("reads a charset the same way for every type in the database", () => {
    /** @type {string[]} */
    const different = [];

    for (const type of Object.keys(db)) {
      const ours = mime.charset(type);
      const theirs = mimeTypes.charset(type);

      if (ours !== theirs) {
        different.push(`${type}: ${ours} !== ${theirs}`);
      }
    }

    expect(different).toStrictEqual([]);
  });

  describe("the spellings an extension arrives in", () => {
    it.each([
      ["js", "text/javascript"],
      [".js", "text/javascript"],
      ["/a/b/c.js", "text/javascript"],
      ["a.b.js", "text/javascript"],
      ["JS", "text/javascript"],
      [".JS", "text/javascript"],
    ])("reads %j as %s", (file, expected) => {
      expect(mime.lookup(file)).toBe(expected);
    });

    it.each([
      ["", false],
      [".", false],
      ["nope", false],
      ["x.nope", false],
    ])("has nothing for %j", (file, expected) => {
      expect(mime.lookup(file)).toBe(expected);
    });

    it("has nothing for what is not a string", () => {
      // The call site hands it `path.extname(...)`, but the lookup is reached
      // from `contentType` as well, and `mime-types` answered `false` here.
      for (const value of [undefined, null, 0, {}, []]) {
        expect(mime.lookup(/** @type {EXPECTED_ANY} */ (value))).toBe(false);
        expect(mime.contentType(/** @type {EXPECTED_ANY} */ (value))).toBe(
          false,
        );
        expect(mime.charset(/** @type {EXPECTED_ANY} */ (value))).toBe(false);
      }
    });
  });

  describe("a Content-Type built from a media type rather than an extension", () => {
    it.each([
      ["text/html", "text/html; charset=utf-8"],
      ["application/json", "application/json; charset=utf-8"],
      ["image/png", "image/png"],
      // A charset already on it is left alone.
      ["text/html; charset=iso-8859-1", "text/html; charset=iso-8859-1"],
    ])("turns %j into %j", (type, expected) => {
      expect(mime.contentType(type)).toBe(expected);
    });
  });

  // The option used to be applied by writing into the table `mime-types`
  // exports, which every consumer in the process shares: two instances
  // accumulated into one map, and anything else requiring `mime-types` saw
  // whatever a middleware had registered.
  describe("the mimeTypes option", () => {
    it("takes an extension the database does not know", () => {
      const custom = createMimeTypes({ mycustom: "text/x-custom" });

      expect(custom.lookup("mycustom")).toBe("text/x-custom");
      expect(custom.lookup(".mycustom")).toBe("text/x-custom");
      expect(custom.contentType(".mycustom")).toBe(
        "text/x-custom; charset=utf-8",
      );
    });

    it("takes precedence over an extension it does know", () => {
      const custom = createMimeTypes({ js: "text/x-mine" });

      expect(custom.lookup(".js")).toBe("text/x-mine");
    });

    it("belongs to the instance that was given it", () => {
      const a = createMimeTypes({ shared: "text/from-a" });
      const b = createMimeTypes({ shared: "text/from-b" });
      const none = createMimeTypes();

      expect(a.lookup("shared")).toBe("text/from-a");
      expect(b.lookup("shared")).toBe("text/from-b");
      expect(none.lookup("shared")).toBe(false);
    });

    it("leaves the database alone", () => {
      createMimeTypes({ js: "text/x-mine" });

      // Not through the instance that registered it: the table every other
      // instance reads.
      expect(createMimeTypes().lookup(".js")).toBe("text/javascript");
      expect(mimeTypes.lookup(".js")).toBe("text/javascript");
    });

    it("is read once, when the middleware is built", () => {
      // The option used to be spread into a table at construction, so the
      // object a caller passed stopped mattering afterwards — and two
      // instances handed the same object could not reach each other through
      // it. Held live, both would have changed.
      const option = { aaa: "text/first" };
      const instance = createMimeTypes(option);

      option.aaa = "text/mutated";
      /** @type {Record<string, string>} */ (option).bbb = "text/added-later";

      expect(instance.lookup("aaa")).toBe("text/first");
      expect(instance.lookup("bbb")).toBe(false);
    });

    it("does not read an inherited property as a registered type", () => {
      // `{}` carries `constructor` and `toString` from its prototype, and an
      // extension by either name would otherwise resolve to a function.
      const custom = createMimeTypes({ js: "text/x-mine" });

      expect(custom.lookup("constructor")).toBe(false);
      expect(custom.lookup("toString")).toBe(false);
    });
  });
});
