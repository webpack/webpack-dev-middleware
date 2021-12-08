module.exports = {
  root: true,
  reportUnusedDisableDirectives: true,
  extends: ["@webpack-contrib/eslint-config-webpack", "prettier"],
  overrides: [
    {
      files: ["src/**/*.js"],
      parserOptions: {
        sourceType: "module",
      },
    },
  ],
};
