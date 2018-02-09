# Welcome!
:heart: Thanks for your interest and time in contributing to this project.

## What We Use

- Building: [Webpack](https://webpack.js.org)
- Linting: [ESLint](http://eslint.org/)
- NPM: [NPM as a Build Tool](https://css-tricks.com/using-npm-build-tool/)
- Testing: [Mocha](https://mochajs.org)

## Forking and Cloning

You'll need to first fork this repository, and then clone it locally before you
can submit a Pull Request with your proposed changes.

Please see the following articles for help getting started with git:

[Forking a Repository](https://help.github.com/articles/fork-a-repo/)
[Cloning a Repository](https://help.github.com/articles/cloning-a-repository/)

## Pull Requests

Please lint and test your changes before submitting a Pull Request. You can lint your
changes by running:

```console
$ npm run lint
```

You can test your changes against the test suite for this module by running:

```console
$ npm run test
```

_Note: Please avoid committing `package-lock.json` files!_

Please don't change variable or parameter names to match your personal
preferences, unless the change is part of a refactor or significant modification
of the codebase (which is very rare).

Please remember to thoroughly explain your Pull Request if it doesn't have an
associated issue. If you're changing code significantly, please remember to add
inline or block comments in the code as appropriate.

## Testing Your Pull Request

You may have the need to test your changes in a real-world project or dependent
module. Thankfully, Github provides a means to do this. Add a dependency to the
`package.json` for such a project as follows:

```json
"webpack-dev-middleware": "webpack/webpack-dev-middleware#{id}/head"
```

Where `{id}` is the # ID of your Pull Request.

## Thanks

For your interest, time, understanding, and for following this simple guide.
