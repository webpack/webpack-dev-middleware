import { defineConfig } from "eslint/config";
import configs from "eslint-config-webpack/configs.js";

export default defineConfig([
  {
    ignores: ["client/**"],
  },
  {
    extends: [configs["recommended-dirty"]],
  },
  {
    files: ["test/helpers/runner.js"],
    rules: {
      "n/hashbang": "off",
    },
  },
  {
    files: ["client-src/**/*.js"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        URLSearchParams: "readonly",
        EventSource: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        module: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-use-before-define": "off",
      "unicorn/prefer-global-this": "off",
      "n/no-unsupported-features/node-builtins": "off",
      "func-names": "off",
      "new-cap": "off",
      "jsdoc/require-jsdoc": "off",
      "jsdoc/no-blank-blocks": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/escape-inline-tags": "off",
      "jsdoc/no-restricted-syntax": "off",
      "prefer-destructuring": "off",
    },
  },
]);
