module.exports = {
  "*": [
    "prettier --cache --write --ignore-unknown",
    "cspell --cache --no-must-find-files --config cspell.config.json",
  ],
  "*.js": ["eslint --cache --fix"],
};
