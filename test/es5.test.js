import fs from "node:fs";
import path from "node:path";

import { transformFileAsync } from "@babel/core";
import * as acorn from "acorn";

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

const ROOT = path.resolve(__dirname, "..");
const CLIENT_SRC = path.resolve(ROOT, "client-src");

// Every node type ES5.1 has. An allowlist rather than a list of forbidden
// types: a syntax nobody thought of here fails the test instead of passing it.
const ES5_NODES = new Set([
  "ArrayExpression",
  "AssignmentExpression",
  "BinaryExpression",
  "BlockStatement",
  "BreakStatement",
  "CallExpression",
  "CatchClause",
  "ConditionalExpression",
  "ContinueStatement",
  "DebuggerStatement",
  "DoWhileStatement",
  "EmptyStatement",
  "ExpressionStatement",
  "ForInStatement",
  "ForStatement",
  "FunctionDeclaration",
  "FunctionExpression",
  "Identifier",
  "IfStatement",
  "LabeledStatement",
  "Literal",
  "LogicalExpression",
  "MemberExpression",
  "NewExpression",
  "ObjectExpression",
  "Program",
  "Property",
  "ReturnStatement",
  "SequenceExpression",
  "SwitchCase",
  "SwitchStatement",
  "ThisExpression",
  "ThrowStatement",
  "TryStatement",
  "UnaryExpression",
  "UpdateExpression",
  "VariableDeclaration",
  "VariableDeclarator",
  "WhileStatement",
  "WithStatement",
]);

// The client ships as an ES module for webpack to bundle and tree-shake, and
// webpack replaces `import.meta.webpackHot` (the only meta property) while
// bundling — neither reaches a browser as syntax.
const MODULE_NODES = new Set([
  "ExportAllDeclaration",
  "ExportDefaultDeclaration",
  "ExportNamedDeclaration",
  "ExportSpecifier",
  "ImportDeclaration",
  "ImportDefaultSpecifier",
  "ImportNamespaceSpecifier",
  "ImportSpecifier",
  "MetaProperty",
]);

// `y` (sticky) and `u` (unicode) are ES6, and so is everything newer (`s`,
// `d`, `v`).
const ES5_REGEXP_FLAGS = new Set(["g", "i", "m"]);

/**
 * @param {string} directory directory to walk
 * @returns {string[]} every `.js` file below it
 */
function listScripts(directory) {
  /** @type {string[]} */
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listScripts(full));
    } else if (entry.name.endsWith(".js")) {
      files.push(full);
    }
  }

  return files.toSorted();
}

/**
 * @param {acorn.Node} ast parsed program
 * @param {(node: EXPECTED_ANY) => void} callback called for every node
 */
function walk(ast, callback) {
  /** @param {EXPECTED_ANY} node node */
  const visit = (node) => {
    if (!node || typeof node.type !== "string") {
      return;
    }

    callback(node);

    for (const key of Object.keys(node)) {
      if (key === "type" || key === "loc") {
        continue;
      }

      const value = node[key];

      if (Array.isArray(value)) {
        for (const item of value) visit(item);
      } else if (value && typeof value === "object") {
        visit(value);
      }
    }
  };

  visit(ast);
}

/**
 * Report everything in the compiled code an ES5 engine cannot run. The node
 * type carries most of it (an arrow function, a class, a template literal and
 * a spread are all types of their own); the rest are ES6 additions to a node
 * type ES5 already had, like `let` on a variable declaration.
 * @param {string} code compiled code
 * @returns {string[]} human readable violations, empty when the code is ES5
 */
function findNonES5(code) {
  const ast = acorn.parse(code, {
    // Parsed as modern syntax on purpose: the point is to report what is not
    // ES5, not to fail on the first token acorn cannot read.
    ecmaVersion: 2025,
    sourceType: "module",
    locations: true,
  });

  /** @type {string[]} */
  const violations = [];

  walk(ast, (node) => {
    const { line, column } = node.loc.start;

    /** @param {string} what what is not ES5 */
    const report = (what) => {
      violations.push(`${line}:${column} ${what}`);
    };

    if (!ES5_NODES.has(node.type) && !MODULE_NODES.has(node.type)) {
      report(node.type);
      return;
    }

    switch (node.type) {
      case "FunctionDeclaration":
      case "FunctionExpression": {
        if (node.generator) report("generator function");
        if (node.async) report("async function");
        break;
      }
      case "Literal": {
        if (typeof node.value === "bigint") report("bigint literal");

        if (
          node.regex &&
          [...node.regex.flags].some((flag) => !ES5_REGEXP_FLAGS.has(flag))
        ) {
          report(`regular expression flag "${node.regex.flags}"`);
        }
        break;
      }
      case "Property": {
        if (node.computed) report("computed property");
        if (node.shorthand) report("shorthand property");
        if (node.method) report("method shorthand");
        break;
      }
      case "VariableDeclaration": {
        if (node.kind !== "var") report(`${node.kind} declaration`);
        break;
      }
      default:
    }
  });

  return violations;
}

describe("client-src", () => {
  const scripts = listScripts(CLIENT_SRC);

  it("has scripts to check", () => {
    expect(scripts.length).toBeGreaterThan(0);
  });

  // The client runs in whatever browser the user's app runs in, so what
  // `babel.config.js` emits for it has to stay ES5 — a single ES6 token is a
  // syntax error that takes the whole bundle down, not a broken feature.
  it.each(scripts.map((file) => [path.relative(ROOT, file), file]))(
    "compiles %s to ES5",
    async (_name, file) => {
      const result = await transformFileAsync(file, {
        cwd: ROOT,
        // Jest runs under `NODE_ENV=test`, where the config compiles for the
        // current node.js instead — this asserts what `npm run build:client`
        // produces.
        envName: "production",
      });

      expect(findNonES5(/** @type {string} */ (result).code)).toEqual([]);
    },
  );
});
