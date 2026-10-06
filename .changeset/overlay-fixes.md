---
"webpack-dev-middleware": patch
---

pr: #2437

The overlay takes focus when it opens and gives it back when it closes, keeps an uncaught runtime error through a successful build, passes a rejected value to `runtimeErrors` filters as `error.cause`, and no longer shows an empty card or leaves the building indicator up after a multi-compiler build. File references in absolute, Windows and `file://` stack frames are now clickable. The ANSI-to-HTML conversion is built in, dropping `ansi-html-community` and fixing its handling of combined, short and unbalanced sequences.
