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
    files: ["client-src/**/*"],
    extends: [configs["browser-outdated-recommended-module"]],
    rules: {
      // Function declarations are hoisted; allow referencing them ahead of
      // their definition for readability.
      "no-use-before-define": ["error", { functions: false }],
    },
  },
]);
