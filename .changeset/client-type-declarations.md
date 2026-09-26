---
"webpack-dev-middleware": patch
---

Ship type declarations for the `./client`, `./client/sse`, `./client/ws`, `./client/indicator` and `./client/overlay` exports, and mark the client as the ES modules it has always been. A TypeScript consumer importing one of them got `any` — or, under `node16`/`nodenext` resolution, the module namespace instead of the default export, because the files are ES modules inside a CommonJS package with nothing saying so
