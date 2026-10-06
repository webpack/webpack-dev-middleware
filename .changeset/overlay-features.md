---
"webpack-dev-middleware": minor
---

pr: #2438

`overlay.id` names the overlay element, so a package embedding it can keep the id its users already query. The new `webpack-dev-middleware/client/problem` export formats one of webpack's errors or warnings with `formatProblem`, and `showProblems` accepts webpack's objects as well as strings.
