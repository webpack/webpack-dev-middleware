/// <reference types="node" />
export = setupOutputFileSystem;
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").WithOptional<import("../index.js").Context<Request, Response>, "watching" | "outputFileSystem">} context
 */
declare function setupOutputFileSystem<
  Request extends import("http").IncomingMessage,
  Response extends import("../index.js").ServerResponse,
>(
  context: import("../index.js").WithOptional<
    import("../index.js").Context<Request, Response>,
    "watching" | "outputFileSystem"
  >,
): void;
declare namespace setupOutputFileSystem {
  export { MultiCompiler, IncomingMessage, ServerResponse };
}
type MultiCompiler = import("webpack").MultiCompiler;
type IncomingMessage = import("../index.js").IncomingMessage;
type ServerResponse = import("../index.js").ServerResponse;
