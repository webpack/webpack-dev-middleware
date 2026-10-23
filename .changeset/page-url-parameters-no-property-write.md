---
"webpack-dev-middleware": patch
---

Read the page's own url parameters without writing a property named after each one. A parameter such as `__proto__` or `constructor` is now looked through like any other instead of becoming a property name to write; behavior is otherwise unchanged.
