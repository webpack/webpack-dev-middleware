import { defineConfig, globalIgnores } from "eslint/config";
import configs from "eslint-config-webpack/configs.js";

export default defineConfig([
  globalIgnores(["client/**/*"]),
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
    files: ["client-src/**/*"],
    extends: [configs["browser-outdated-recommended-commonjs"]],
    languageOptions: {
      // The preset bundles `javascript/es5` (parser locked to ES5) which
      // rejects `const`. The module variant of the same preset overrides
      // this to "latest" upstream; we replicate that for the commonjs one
      // until eslint-config-webpack does it itself.
      ecmaVersion: "latest",
    },
    rules: {
      // Function declarations are hoisted; allow referencing them ahead of
      // their definition for readability.
      "no-use-before-define": ["error", { functions: false }],
    },
  },
]);
