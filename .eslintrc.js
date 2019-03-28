module.exports = {
  root: true,
  plugins: ['prettier'],
  extends: ['@webpack-contrib/eslint-config-webpack'],
  parserOptions: {
    sourceType: 'script',
  },
  rules: {
    'prettier/prettier': ['error'],
    strict: ['error', 'safe'],
  },
};
