import { IncomingMessage, ServerResponse } from "node:http";
import webpack = require("webpack");
import middleware = require("../../..");

const compiler = webpack({ mode: "development" });
const koa = middleware.koaWrapper(compiler);
const hono = middleware.honoWrapper(compiler);

for (const wrapper of [koa, hono]) {
  const api: ReturnType<typeof middleware> = wrapper.devMiddleware;
  api.waitUntilValid(() => {});
  api.invalidate(() => {});
  api.close(() => {});
  api.context.options.publicPath = "/assets/";
  // @ts-expect-error The underlying API must not become untyped.
  wrapper.devMiddleware.missingMethod();
  // @ts-expect-error Invalid options must still be rejected.
  wrapper.devMiddleware.context.options.publicPath = 123;
}

interface CustomRequest extends IncomingMessage {
  customRequest: string;
}
interface CustomResponse extends ServerResponse {
  customResponse: string;
}

const customKoa = middleware.koaWrapper<CustomRequest, CustomResponse>(compiler);
const customHono = middleware.honoWrapper<CustomRequest, CustomResponse>(compiler);
for (const wrapper of [customKoa, customHono]) {
  const api: middleware.API<CustomRequest, CustomResponse> = wrapper.devMiddleware;
  wrapper.devMiddleware.context.options.headers = (req, res) => ({
    "X-Request": req.customRequest,
    "X-Response": res.customResponse,
  });
  // @ts-expect-error Custom request properties remain typed.
  wrapper.devMiddleware.context.options.headers = (req) => ({ "X-Invalid": req.missingProperty });
}
