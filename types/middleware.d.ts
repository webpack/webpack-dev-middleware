/**
 * @param {Context} context
 * @return {Middleware}
 */
export default function wrapper(context: Context): Middleware;
export type Context = import("./index.js").Context;
export type Request = import("./index.js").Request;
export type Response = import("./index.js").Response;
export type Next = import("./index.js").Next;
export type Middleware = import("./index.js").Middleware;
