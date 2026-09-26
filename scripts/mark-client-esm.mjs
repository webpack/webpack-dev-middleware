// The browser client keeps ESM syntax (babel runs with `modules: false` so
// webpack can tree-shake it), but the package itself is CommonJS. Without a
// marker, Node and TypeScript resolve `client/*.js` and its declarations as
// CommonJS, and a consumer importing the default gets the module namespace
// rather than the class. A nested `package.json` says what these two
// directories really contain, without renaming a published file — those paths
// are what `client.webSocketTransport` points at.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Not `import.meta.dirname`: this package supports node.js 20.9, which does not
// have it.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const dir of ["client", "types/client"]) {
  await writeFile(
    path.join(ROOT, dir, "package.json"),
    `${JSON.stringify({ type: "module" }, null, 2)}\n`,
  );
}
