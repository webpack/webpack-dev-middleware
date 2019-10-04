module.exports = {
  root: true,
  extends: ['@webpack-contrib/eslint-config-webpack', 'prettier'],
  overrides: [
    {
      files: ['lib/**/*.js'],
      parserOptions: {
        sourceType: 'script',
      },
    },
  ],
};
