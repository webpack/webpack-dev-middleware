import { defineConfig, globalIgnores } from "eslint/config";
import configs from "eslint-config-webpack/configs.js";

export default defineConfig([
  globalIgnores(["client/**/*", "examples/**/*"]),
  {
    extends: [configs["recommended-dirty"]],
    ignores: ["client-src/**/*"],
  },
  {
    files: ["test/helpers/runner.js"],
    rules: {
      "n/hashbang": "off",
    },
  },
  {
    // `@changesets/get-github-info` is ESM-only and ships an `exports` map with
    // no `main`, which the import resolver cannot follow. Node resolves it.
    files: [".changeset/changelog-generator.mjs"],
    rules: {
      "import/no-unresolved": "off",
    },
  },
  {
    files: ["client-src/**/*"],
    extends: [configs["browser-outdated-recommended-module"]],
  },
]);
