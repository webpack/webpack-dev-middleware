---
"webpack-dev-middleware": patch
---

Fixed `autoConnect` on the client's query being read differently from every other boolean there. It tested `=== "true"` while the rest test `!== "false"`, so a value it did not recognise — `?autoConnect=1` — turned the client off rather than leaving it on, and since the default is already on, turning it off is the only thing anyone writes it for.
