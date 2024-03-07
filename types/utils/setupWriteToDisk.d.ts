/// <reference types="node" />
export = setupWriteToDisk;
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Compilation} Compilation */
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").Context<Request, Response>} context
 */
declare function setupWriteToDisk<
  Request extends import("http").IncomingMessage,
  Response extends import("../index.js").ServerResponse,
>(context: import("../index.js").Context<Request, Response>): void;
declare namespace setupWriteToDisk {
  export {
    Compiler,
    MultiCompiler,
    Compilation,
    IncomingMessage,
    ServerResponse,
  };
}
type Compiler = import("webpack").Compiler;
type MultiCompiler = import("webpack").MultiCompiler;
type Compilation = import("webpack").Compilation;
type IncomingMessage = import("../index.js").IncomingMessage;
type ServerResponse = import("../index.js").ServerResponse;
