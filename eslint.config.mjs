import { defineConfig } from "eslint/config";
import configs from "eslint-config-webpack/configs.js";

export default defineConfig([
  {
    extends: [configs["recommended-dirty"]],
  },
  {
    files: ["test/helpers/runner.js"],
    rules: {
      "n/hashbang": "off",
    },
  },
]);
