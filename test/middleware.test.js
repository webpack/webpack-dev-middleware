import fs from "fs";
import path from "path";

import connect from "connect";
import express from "express";
import koa from "koa";
import Hapi from "@hapi/hapi";
import request from "supertest";
import memfs, { createFsFromVolume, Volume } from "memfs";
import del from "del";

import middleware from "../src";

import getCompiler from "./helpers/getCompiler";

import webpackConfig from "./fixtures/webpack.config";
import webpackMultiConfig from "./fixtures/webpack.array.config";
import webpackWatchOptionsConfig from "./fixtures/webpack.watch-options.config";
import webpackMultiWatchOptionsConfig from "./fixtures/webpack.array.watch-options.config";
import webpackQueryStringConfig from "./fixtures/webpack.querystring.config";
import webpackClientServerConfig from "./fixtures/webpack.client.server.config";

// Suppress unnecessary stats output
// global.console.log = jest.fn();

async function startServer(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen((error) => {
      if (error) {
        return reject(error);
      }

      return resolve(server);
    });
  });
}

async function frameworkFactory(
  name,
  framework,
  compiler,
  devMiddlewareOptions,
  options = {},
) {
  switch (name) {
    case "hapi": {
      const server = framework.server();
      const hapiPlugin = {
        plugin: middleware.hapiPlugin(),
        options: {
          compiler,
          ...devMiddlewareOptions,
        },
      };

      const middlewares =
        typeof options.setupMiddlewares === "function"
          ? options.setupMiddlewares([hapiPlugin])
          : [hapiPlugin];

      await Promise.all(
        middlewares.map((item) => {
          // eslint-disable-next-line no-shadow
          const { plugin, options } = item;

          return server.register({
            plugin,
            options,
          });
        }),
      );

      await server.start();

      const req = request(server.listener);

      return [server, req, server.webpackDevMiddleware];
    }
    case "koa": {
      // eslint-disable-next-line new-cap
      const app = new framework();
      const instance = middleware(compiler, devMiddlewareOptions);
      const wrapper = (ctx, next) =>
        new Promise((resolve, reject) => {
          const { req } = ctx;
          const { res } = ctx;

          res.locals = ctx.state;
          res.sendStream = (content) => {
            ctx.body = content;
            resolve();
          };
          res.sendFile = (content) => {
            ctx.body = content;
            resolve();
          };

          instance(req, res, (err) => {
            if (err) {
              reject(err);
              return;
            }

            resolve(next());
          });
        });

      const middlewares =
        typeof options.setupMiddlewares === "function"
          ? options.setupMiddlewares([wrapper])
          : [wrapper];

      for (const item of middlewares) {
        if (item.route) {
          app.use(item.route, item.fn);
        } else {
          app.use(item);
        }
      }

      const server = await startServer(app);
      const req = request(server);

      return [server, req, instance];
    }
    default: {
      const app = framework();
      const instance = middleware(compiler, devMiddlewareOptions);
      const middlewares =
        typeof options.setupMiddlewares === "function"
          ? options.setupMiddlewares([instance])
          : [instance];

      for (const item of middlewares) {
        if (item.route) {
          app.use(item.route, item.fn);
        } else {
          app.use(item);
        }
      }

      const server = await startServer(app);
      const req = request(app);

      return [server, req, instance];
    }
  }
}

async function closeServer(server) {
  // hapi
  if (typeof server.stop === "function") {
    return server.stop();
  }

  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);

        return;
      }

      resolve();
    });
  });
}

async function close(server, instance) {
  return Promise.resolve()
    .then(() => {
      if (!instance.context.watching.closed) {
        return new Promise((resolve, reject) => {
          instance.close((err) => {
            if (err) {
              reject(err);
              return;
            }

            resolve();
          });
        });
      }

      return Promise.resolve();
    })
    .then(() => {
      if (server) {
        return closeServer(server);
      }

      return Promise.resolve();
    });
}

function get404ContentTypeHeader(name) {
  switch (name) {
    case "koa":
      return "text/plain; charset=utf-8";
    case "hapi":
      return "application/json; charset=utf-8";
    default:
      return "text/html; charset=utf-8";
  }
}

function applyTestMiddleware(name, middlewares) {
  if (name === "hapi") {
    middlewares.push({
      plugin: {
        name: "myPlugin",
        version: "1.0.0",
        register(innerServer) {
          innerServer.route({
            method: "GET",
            path: "/file.jpg",
            handler() {
              return "welcome";
            },
          });
        },
      },
    });
  } else {
    middlewares.push({
      route: "/file.jpg",
      fn: (req, res) => {
        // Express API
        if (res.send) {
          res.send("welcome");
        }
        // Connect API
        else {
          res.setHeader("Content-Type", "text/html");
          res.end("welcome");
        }
      },
    });
  }

  return middlewares;
}

describe.each([
  ["connect", connect],
  ["express", express],
  ["koa", koa],
  ["hapi", Hapi],
])("%s framework:", (name, framework) => {
  describe("middleware", () => {
    let instance;
    let server;
    let app;
    let req;

    describe("basic", () => {
      describe("should work", () => {
        let compiler;
        let codeContent;

        const outputPath = path.resolve(__dirname, "./outputs/basic-test");

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });
          compiler.hooks.afterCompile.tap("wdm-test", (params) => {
            codeContent = params.assets["bundle.js"].source();
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "image.svg"),
            "svg image",
          );
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "image image.svg"),
            "svg image",
          );
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "byte-length.html"),
            "\u00bd + \u00bc = \u00be",
          );
          instance.context.outputFileSystem.mkdirSync(
            path.resolve(outputPath, "directory/nested-directory"),
            { recursive: true },
          );
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "directory/nested-directory/index.html"),
            "My Index.",
          );
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "throw-an-exception-on-readFileSync.txt"),
            "exception",
          );
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "unknown"),
            "unknown",
          );

          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "empty-file.txt"),
            "",
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it("should not find the bundle file on disk", async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
          expect(fs.existsSync(path.resolve(outputPath, "bundle.js"))).toBe(
            false,
          );
        });

        it('should return the "200" code for the "GET" request to the bundle file', async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            String(Buffer.byteLength(codeContent)),
          );
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
          expect(response.text).toEqual(codeContent);
        });

        it('should return the "200" code for the "HEAD" request to the bundle file', async () => {
          const response = await req.head("/bundle.js");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            String(Buffer.byteLength(codeContent)),
          );
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
          expect(response.text).toBeUndefined();
        });

        it('should return the "404" code for the "POST" request to the bundle file', async () => {
          const response = await req.post("/bundle.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return the "200" code for the "GET" request to the "image.svg" file', async () => {
          const fileData = instance.context.outputFileSystem.readFileSync(
            path.resolve(outputPath, "image.svg"),
          );

          const response = await req.get("/image.svg");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            fileData.byteLength.toString(),
          );
          expect(response.headers["content-type"]).toEqual("image/svg+xml");
        });

        it('should return the "200" code for the "GET" request to the "image.svg" file with "/../"', async () => {
          const fileData = instance.context.outputFileSystem.readFileSync(
            path.resolve(outputPath, "image.svg"),
          );

          const response = await req.get("/public/../image.svg");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            fileData.byteLength.toString(),
          );
          expect(response.headers["content-type"]).toEqual("image/svg+xml");
        });

        it('should return the "200" code for the "GET" request to the "image.svg" file with "/../../../"', async () => {
          const fileData = instance.context.outputFileSystem.readFileSync(
            path.resolve(outputPath, "image.svg"),
          );

          const response = await req.get(
            "/public/assets/images/../../../image.svg",
          );

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            fileData.byteLength.toString(),
          );
          expect(response.headers["content-type"]).toEqual("image/svg+xml");
        });

        it('should return the "200" code for the "GET" request to the directory', async () => {
          const fileData = fs.readFileSync(
            path.resolve(__dirname, "./fixtures/index.html"),
          );

          const response = await req.get("/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            fileData.byteLength.toString(),
          );
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(response.text).toEqual(fileData.toString());
        });

        it('should return the "200" code for the "GET" request to the subdirectory with "index.html"', async () => {
          const fileData = instance.context.outputFileSystem.readFileSync(
            path.resolve(outputPath, "directory/nested-directory/index.html"),
          );

          const response = await req.get("/directory/nested-directory/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            fileData.byteLength.toString(),
          );
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(response.text).toEqual(fileData.toString());
        });

        it('should return the "200" code for the "GET" request to the subdirectory with "index.html" without trailing slash', async () => {
          const fileData = instance.context.outputFileSystem.readFileSync(
            path.resolve(outputPath, "directory/nested-directory/index.html"),
          );

          const response = await req.get("/directory/nested-directory");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            fileData.byteLength.toString(),
          );
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(response.text).toEqual(fileData.toString());
        });

        it('should return the "200" code for the "GET" request to the subdirectory with "index.html"', async () => {
          const fileData = instance.context.outputFileSystem.readFileSync(
            path.resolve(outputPath, "directory/nested-directory/index.html"),
          );

          const response = await req.get(
            "/directory/nested-directory/index.html",
          );

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            fileData.byteLength.toString(),
          );
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(response.text).toEqual(fileData.toString());
        });

        it('should return the "416" code for the "GET" request with the invalid range header', async () => {
          const response = await req
            .get("/bundle.js")
            .set("Range", "bytes=9999999-");

          expect(response.statusCode).toEqual(416);
          expect(response.headers["content-range"]).toEqual(
            `bytes */${Buffer.byteLength(codeContent)}`,
          );
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(response.text).toEqual(
            `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Range Not Satisfiable</pre>
</body>
</html>`,
          );
        });

        it('should return the "206" code for the "GET" request with the valid range header', async () => {
          const response = await req
            .get("/bundle.js")
            .set("Range", "bytes=3000-3500");

          expect(response.statusCode).toEqual(206);
          expect(response.headers["content-range"]).toEqual(
            `bytes 3000-3500/${Buffer.byteLength(codeContent)}`,
          );
          expect(response.headers["content-length"]).toEqual("501");
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
          expect(response.text).toBe(codeContent.slice(3000, 3501));
          expect(response.text.length).toBe(501);
        });

        it('should return the "206" code for the "GET" request with the valid range header for "HEAD" request', async () => {
          const response = await req
            .head("/bundle.js")
            .set("Range", "bytes=3000-3500");

          expect(response.statusCode).toEqual(206);
          expect(response.headers["content-range"]).toEqual(
            `bytes 3000-3500/${Buffer.byteLength(codeContent)}`,
          );
          expect(response.headers["content-length"]).toEqual("501");
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
          expect(response.text).toBeUndefined();
        });

        it('should return the "206" code for the "GET" request with the valid range header (lowercase)', async () => {
          const response = await req
            .get("/bundle.js")
            .set("range", "bytes=3000-3500");

          expect(response.statusCode).toEqual(206);
          expect(response.headers["content-range"]).toEqual(
            `bytes 3000-3500/${Buffer.byteLength(codeContent)}`,
          );
          expect(response.headers["content-length"]).toEqual("501");
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
          expect(response.text).toBe(codeContent.slice(3000, 3501));
          expect(response.text.length).toBe(501);
        });

        it('should return the "206" code for the "GET" request with the valid range header (uppercase)', async () => {
          const response = await req
            .get("/bundle.js")
            .set("RANGE", "BYTES=3000-3500");

          expect(response.statusCode).toEqual(206);
          expect(response.headers["content-range"]).toEqual(
            `bytes 3000-3500/${Buffer.byteLength(codeContent)}`,
          );
          expect(response.headers["content-length"]).toEqual("501");
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
          expect(response.text).toBe(codeContent.slice(3000, 3501));
          expect(response.text.length).toBe(501);
        });

        it('should return the "206" code for the "GET" request with the valid range header when range starts with 0', async () => {
          const response = await req
            .get("/bundle.js")
            .set("Range", "bytes=0-3500");

          expect(response.statusCode).toEqual(206);
          expect(response.headers["content-range"]).toEqual(
            `bytes 0-3500/${Buffer.byteLength(codeContent)}`,
          );
          expect(response.headers["content-length"]).toEqual("3501");
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
          expect(response.text).toBe(codeContent.slice(0, 3501));
          expect(response.text.length).toBe(3501);
        });

        it('should return the "206" code for the "GET" request with the valid range header with multiple values', async () => {
          const response = await req
            .get("/bundle.js")
            .set("Range", "bytes=0-499, 499-800");

          expect(response.statusCode).toEqual(206);
          expect(response.headers["content-range"]).toEqual(
            `bytes 0-800/${Buffer.byteLength(codeContent)}`,
          );
          expect(response.headers["content-length"]).toEqual("801");
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
          expect(response.text).toBe(codeContent.slice(0, 801));
          expect(response.text.length).toBe(801);
        });

        it('should return the "200" code for the "GET" request with malformed range header which is ignored', async () => {
          const response = await req.get("/bundle.js").set("Range", "abc");

          expect(response.statusCode).toEqual(200);
        });

        it('should return the "200" code for the "GET" request with malformed range header which is ignored #2', async () => {
          const response = await req.get("/bundle.js").set("Range", "bytes");

          expect(response.statusCode).toEqual(200);
        });

        it('should return the "200" code for the "GET" request with multiple range header which is ignored', async () => {
          const response = await req
            .get("/bundle.js")
            .set("Range", "bytes=3000-3100,3200-3300");

          expect(response.statusCode).toEqual(200);
        });

        it('should return the "404" code for the "GET" request with to the non-public path', async () => {
          const response = await req.get("/nonpublic/");

          expect(response.statusCode).toEqual(404);
        });

        it('should return the "404" code for the "GET" request to the deleted file', async () => {
          const spy = jest
            .spyOn(instance.context.outputFileSystem, "readFileSync")
            .mockImplementation(() => {
              throw new Error("error");
            });

          const response = await req.get(
            "/public/throw-an-exception-on-readFileSync.txt/",
          );

          expect(response.statusCode).toEqual(404);

          spy.mockRestore();
        });

        it('should return "200" code code for the "GET" request to the file without extension', async () => {
          const fileData = instance.context.outputFileSystem.readFileSync(
            path.resolve(outputPath, "unknown"),
          );

          const response = await req.get("/unknown");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            fileData.byteLength.toString(),
          );
        });

        it('should return "200" code for the "GET" request and "Content-Length" to the file with unicode', async () => {
          const response = await req.get("/byte-length.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual("12");
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(fs.existsSync(path.resolve(outputPath, "bundle.js"))).toBe(
            false,
          );
        });

        it('should return "200" code for the "GET" request and "Content-Length" of "0" when file is empty', async () => {
          const response = await req.get("/empty-file.txt");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual("0");
          expect(response.headers["content-type"]).toEqual(
            "text/plain; charset=utf-8",
          );
        });

        it('should return the "200" code for the "GET" request to the "image image.svg" file', async () => {
          const fileData = instance.context.outputFileSystem.readFileSync(
            path.resolve(outputPath, "image image.svg"),
          );

          const response = await req.get("/image image.svg");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            fileData.byteLength.toString(),
          );
          expect(response.headers["content-type"]).toEqual("image/svg+xml");
        });

        it('should return the "404" code for the "GET" request to the "%FF" file', async () => {
          const response = await req.get("/%FF");

          expect(response.statusCode).toEqual(404);
          expect(response.headers["content-type"]).toEqual(
            get404ContentTypeHeader(name),
          );
        });
      });

      describe('should not work with the broken "publicPath" option', () => {
        let compiler;

        const outputPath = path.resolve(__dirname, "./outputs/basic");

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
              publicPath: "https://test:malfor%5Med@test.example.com",
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "400" code for the "GET" request to the bundle file', async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(404);
        });
      });

      describe("should work in multi-compiler mode", () => {
        beforeAll(async () => {
          const compiler = getCompiler(webpackMultiConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file for the first compiler', async () => {
          const response = await req.get("/static-one/bundle.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to a non existing file for the first compiler', async () => {
          const response = await req.get("/static-one/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the "public" path for the first compiler', async () => {
          const response = await req.get("/static-one/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the "index" option for the first compiler', async () => {
          const response = await req.get("/static-one/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request for the bundle file for the second compiler', async () => {
          const response = await req.get("/static-two/bundle.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to a non existing file for the second compiler', async () => {
          const response = await req.get("/static-two/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to the "public" path for the second compiler', async () => {
          const response = await req.get("/static-two/");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to the "index" option for the second compiler', async () => {
          const response = await req.get("/static-two/index.html");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to the non-public path', async () => {
          const response = await req.get("/static-three/");

          expect(response.statusCode).toEqual(404);
          expect(response.headers["content-type"]).toEqual(
            get404ContentTypeHeader(name),
          );
        });

        it('should return "404" code for GET request to the non-public path', async () => {
          const response = await req.get("/static-three/invalid.js");

          expect(response.statusCode).toEqual(404);
          expect(response.headers["content-type"]).toEqual(
            get404ContentTypeHeader(name),
          );
        });

        it('should return "404" code for GET request to the non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
          expect(response.headers["content-type"]).toEqual(
            get404ContentTypeHeader(name),
          );
        });
      });

      describe("should work with difference requests", () => {
        const basicOutputPath = path.resolve(__dirname, "./outputs/basic");
        const fixtures = [
          {
            urls: [
              {
                value: "bundle.js",
                contentType: "application/javascript; charset=utf-8",
                code: 200,
              },
              {
                value: "",
                contentType: "text/html; charset=utf-8",
                code: 200,
              },
              {
                value: "index.html",
                contentType: "text/html; charset=utf-8",
                code: 200,
              },
              {
                value: "invalid.js",
                contentType: get404ContentTypeHeader(name),
                code: 404,
              },
              {
                value: "complex",
                contentType: get404ContentTypeHeader(name),
                code: 404,
              },
              {
                value: "complex/invalid.js",
                contentType: get404ContentTypeHeader(name),
                code: 404,
              },
              {
                value: "complex/complex",
                contentType: get404ContentTypeHeader(name),
                code: 404,
              },
              {
                value: "complex/complex/invalid.js",
                contentType: get404ContentTypeHeader(name),
                code: 404,
              },
              {
                value: "%",
                contentType: get404ContentTypeHeader(name),
                code: 404,
              },
            ],
          },
          {
            file: "config.json",
            data: JSON.stringify({ foo: "bar" }),
            urls: [
              {
                value: "config.json",
                contentType: "application/json; charset=utf-8",
                code: 200,
              },
            ],
          },
          {
            file: "image.svg",
            data: "<svg>SVG</svg>",
            urls: [
              {
                value: "image.svg",
                contentType: "image/svg+xml",
                code: 200,
              },
            ],
          },
          {
            file: "foo.js",
            data: 'console.log("foo");',
            urls: [
              {
                value: "foo.js",
                contentType: "application/javascript; charset=utf-8",
                code: 200,
              },
            ],
          },
          {
            file: "/complex/foo.js",
            data: 'console.log("foo");',
            urls: [
              {
                value: "complex/foo.js",
                contentType: "application/javascript; charset=utf-8",
                code: 200,
              },
              {
                value: "complex/./foo.js",
                contentType: "application/javascript; charset=utf-8",
                code: 200,
              },
              {
                value: "complex/foo/../foo.js",
                contentType: "application/javascript; charset=utf-8",
                code: 200,
              },
            ],
          },
          {
            file: "/complex/complex/foo.js",
            data: 'console.log("foo");',
            urls: [
              {
                value: "complex/complex/foo.js",
                contentType: "application/javascript; charset=utf-8",
                code: 200,
              },
            ],
          },
          {
            file: "/föö.js",
            data: 'console.log("foo");',
            urls: [
              // Express encodes the URI component, so we do the same
              {
                value: "f%C3%B6%C3%B6.js",
                contentType: "application/javascript; charset=utf-8",
                code: 200,
              },
            ],
          },
          {
            file: "/%foo%/%foo%.js",
            data: 'console.log("foo");',
            urls: [
              // Filenames can contain characters not allowed in URIs
              {
                value: "%foo%/%foo%.js",
                contentType: "application/javascript; charset=utf-8",
                code: 200,
              },
            ],
          },
          {
            file: "test.html",
            data: "<div>test</div>",
            urls: [
              {
                value: "test.html?foo=bar",
                contentType: "text/html; charset=utf-8",
                code: 200,
              },
              {
                value: "test.html?foo=bar#hash",
                contentType: "text/html; charset=utf-8",
                code: 200,
              },
            ],
          },
          {
            file: "pathname with spaces.js",
            data: 'console.log("foo");',
            urls: [
              {
                value: "pathname%20with%20spaces.js",
                contentType: "application/javascript; charset=utf-8",
                code: 200,
              },
            ],
          },
          {
            file: "dirname with spaces/filename with spaces.js",
            data: 'console.log("foo");',
            urls: [
              {
                value: "dirname%20with%20spaces/filename%20with%20spaces.js",
                contentType: "application/javascript; charset=utf-8",
                code: 200,
              },
            ],
          },
          {
            file: "filename-name-with-dots/mono-v6.x.x",
            data: "content with .",
            urls: [
              {
                value: "filename-name-with-dots/mono-v6.x.x",
                code: 200,
              },
            ],
          },
          {
            file: "noextension",
            data: "noextension content",
            urls: [
              {
                value: "noextension",
                code: 200,
              },
            ],
          },
          {
            file: "3dAr.usdz",
            data: "3dAr.usdz content",
            urls: [
              {
                value: "3dAr.usdz",
                contentType: "model/vnd.usdz+zip",
                code: 200,
              },
            ],
          },
          {
            file: "hello.wasm",
            data: "hello.wasm content",
            urls: [
              {
                value: "hello.wasm",
                contentType: "application/wasm",
                code: 200,
              },
            ],
          },
          {
            file: "windows.txt",
            data: "windows.txt content",
            urls: [
              {
                value: "windows.txt",
                contentType: "text/plain; charset=utf-8",
                code: 200,
              },
            ],
          },
          {
            file: "windows 2.txt",
            data: "windows 2.txt content",
            urls: [
              {
                value: "windows%202.txt",
                contentType: "text/plain; charset=utf-8",
                code: 200,
              },
            ],
          },
          {
            file: "test & test & %20.txt",
            data: "test & test & %20.txt content",
            urls: [
              {
                value: "test%20%26%20test%20%26%20%2520.txt",
                contentType: "text/plain; charset=utf-8",
                code: 200,
              },
            ],
          },
        ];

        const configurations = [
          {
            output: { path: basicOutputPath, publicPath: "" },
            publicPathForRequest: "/",
          },
          {
            output: {
              path: path.join(basicOutputPath, "dist"),
              publicPath: "",
            },
            publicPathForRequest: "/",
          },
          {
            output: { path: basicOutputPath, publicPath: "/" },
            publicPathForRequest: "/",
          },
          {
            output: {
              path: path.join(basicOutputPath, "dist"),
              publicPath: "/",
            },
            publicPathForRequest: "/",
          },
          {
            output: { path: basicOutputPath, publicPath: "/static" },
            publicPathForRequest: "/static/",
          },
          {
            output: {
              path: path.join(basicOutputPath, "dist"),
              publicPath: "/static",
            },
            publicPathForRequest: "/static/",
          },
          {
            output: { path: basicOutputPath, publicPath: "/static/" },
            publicPathForRequest: "/static/",
          },
          {
            output: {
              path: path.join(basicOutputPath, "dist"),
              publicPath: "/static/",
            },
            publicPathForRequest: "/static/",
          },
          {
            output: {
              path: path.join(basicOutputPath, "dist/#leadinghash"),
              publicPath: "/",
            },
            publicPathForRequest: "/",
          },
          {
            output: {
              path: basicOutputPath,
              publicPath: "http://127.0.0.1/",
            },
            publicPathForRequest: "/",
          },
          {
            output: {
              path: basicOutputPath,
              publicPath: "http://127.0.0.1:3000/",
            },
            publicPathForRequest: "/",
          },
          {
            output: {
              path: basicOutputPath,
              publicPath: "//test.domain/",
            },
            publicPathForRequest: "/",
          },
          {
            output: {
              path: path.join(basicOutputPath, "my static"),
              publicPath: "/static/",
            },
            publicPathForRequest: "/static/",
          },
          {
            output: {
              path: path.join(basicOutputPath, "my%20static"),
              publicPath: "/static/",
            },
            publicPathForRequest: "/static/",
          },
          {
            output: {
              path: path.join(basicOutputPath, "my %20 static"),
              publicPath: "/my%20static/",
            },
            publicPathForRequest: "/my%20static/",
          },
        ];

        for (const configuration of configurations) {
          // eslint-disable-next-line no-loop-func
          describe("should work handle requests", () => {
            const { output, publicPathForRequest } = configuration;
            const { path: outputPath, publicPath } = output;

            let compiler;

            beforeAll(async () => {
              compiler = getCompiler({
                ...webpackConfig,
                output: {
                  filename: "bundle.js",
                  path: outputPath,
                  publicPath,
                },
              });

              [server, req, instance] = await frameworkFactory(
                name,
                framework,
                compiler,
              );

              const {
                context: {
                  outputFileSystem: { mkdirSync, writeFileSync },
                },
              } = instance;

              for (const { file, data } of fixtures) {
                if (file) {
                  const fullPath = path.join(outputPath, file);

                  mkdirSync(path.dirname(fullPath), { recursive: true });
                  writeFileSync(fullPath, data);
                }
              }
            });

            afterAll(async () => {
              await close(server, instance);
            });

            for (const { data, urls } of fixtures) {
              for (const { value, contentType, code } of urls) {
                // eslint-disable-next-line no-loop-func
                it(`should return the "${code}" code for the "GET" request for the "${value}" url`, async () => {
                  const response = await req.get(
                    `${publicPathForRequest}${value}`,
                  );

                  expect(response.statusCode).toEqual(code);

                  if (data) {
                    expect(response.headers["content-length"]).toEqual(
                      String(data.length),
                    );
                  }

                  if (contentType) {
                    expect(response.headers["content-type"]).toEqual(
                      contentType,
                    );
                  }
                });
              }
            }
          });
        }
      });

      describe('should respect the value of the "Content-Type" header from other middleware', () => {
        beforeAll(async () => {
          const compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            // eslint-disable-next-line no-undefined
            undefined,
            {
              setupMiddlewares: (middlewares) => {
                if (name === "hapi") {
                  middlewares.unshift({
                    plugin: {
                      name: "myPlugin",
                      version: "1.0.0",
                      register(innerServer) {
                        innerServer.ext("onRequest", (innerRequest, h) => {
                          innerRequest.raw.res.setHeader(
                            "Content-Type",
                            "application/vnd.test+octet-stream",
                          );

                          return h.continue;
                        });
                      },
                    },
                  });
                } else {
                  middlewares.unshift((req, res, next) => {
                    // Express API
                    if (res.set) {
                      res.set(
                        "Content-Type",
                        "application/vnd.test+octet-stream",
                      );
                    }
                    // Connect API
                    else {
                      res.setHeader(
                        "Content-Type",
                        "application/vnd.test+octet-stream",
                      );
                    }

                    next();
                  });
                }

                return middlewares;
              },
            },
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should not modify the "Content-Type" header', async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "application/vnd.test+octet-stream",
          );
        });
      });

      describe('should work without "output" options', () => {
        beforeAll(async () => {
          // eslint-disable-next-line no-undefined
          const compiler = getCompiler({ ...webpackConfig, output: undefined });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file', async () => {
          const response = await req.get("/main.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to a nonexistent file', async () => {
          const response = await req.get("/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the "index" option', async () => {
          const response = await req.get("/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });
      });

      describe('should work with trailing slash at the end of the "option.path" option', () => {
        beforeAll(async () => {
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: path.resolve(__dirname, "./outputs/basic/"),
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file', async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to a nonexistent file', async () => {
          const response = await req.get("/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the "index" option', async () => {
          const response = await req.get("/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });
      });

      describe('should respect empty "output.publicPath" and "output.path" options', () => {
        beforeAll(async () => {
          const compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file', async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to a nonexistent file', async () => {
          const response = await req.get("/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the "index" option', async () => {
          const response = await req.get("/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });
      });

      describe('should respect "output.publicPath" and "output.path" options', () => {
        beforeAll(async () => {
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              publicPath: "/static/",
              path: path.resolve(__dirname, "./outputs/other-basic"),
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file', async () => {
          const response = await req.get("/static/bundle.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to a nonexistent file', async () => {
          const response = await req.get("/static/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the public path', async () => {
          const response = await req.get("/static/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the "index" option', async () => {
          const response = await req.get("/static/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to the non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
          expect(response.headers["content-type"]).toEqual(
            get404ContentTypeHeader(name),
          );
        });
      });

      describe('should respect "output.publicPath" and "output.path" options with hash substitutions', () => {
        let hash;

        beforeAll(async () => {
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              publicPath: "/static/[fullhash]/",
              path: path.resolve(__dirname, "./outputs/other-basic-[fullhash]"),
            },
          });
          compiler.hooks.afterCompile.tap("wdm-test", ({ hash: h }) => {
            hash = h;
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );

          await new Promise((resolve) => {
            const interval = setInterval(() => {
              if (hash) {
                clearInterval(interval);

                resolve();
              }
            }, 10);
          });
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file', async () => {
          const response = await req.get(`/static/${hash}/bundle.js`);

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to a nonexistent file', async () => {
          const response = await req.get("/static/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the public path', async () => {
          const response = await req.get(`/static/${hash}/`);

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the "index" option', async () => {
          const response = await req.get(`/static/${hash}/index.html`);

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to the non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
        });
      });

      describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode with hash substitutions', () => {
        let hashOne;
        let hashTwo;

        beforeAll(async () => {
          const compiler = getCompiler([
            {
              ...webpackMultiConfig[0],
              output: {
                filename: "bundle.js",
                path: path.resolve(
                  __dirname,
                  "./outputs/array-[fullhash]/static-one",
                ),
                publicPath: "/static-one/[fullhash]/",
              },
            },
            {
              ...webpackMultiConfig[1],
              output: {
                filename: "bundle.js",
                path: path.resolve(
                  __dirname,
                  "./outputs/array-[fullhash]/static-two",
                ),
                publicPath: "/static-two/[fullhash]/",
              },
            },
          ]);
          compiler.hooks.done.tap("wdm-test", (stats) => {
            const [one, two] = stats.stats;

            hashOne = one.hash;
            hashTwo = two.hash;
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );

          await new Promise((resolve) => {
            const interval = setInterval(() => {
              if (hashOne && hashTwo) {
                clearInterval(interval);

                resolve();
              }
            }, 10);
          });
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file for the first compiler', async () => {
          const response = await req.get(`/static-one/${hashOne}/bundle.js`);

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to nonexistent file for the first compiler', async () => {
          const response = await req.get(`/static-one/${hashOne}/invalid.js`);

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request for the second bundle file', async () => {
          const response = await req.get(`/static-one/${hashOne}/`);

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the "index" option for the first compiler', async () => {
          const response = await req.get(`/static-one/${hashOne}/index.html`);

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the bundle file for the second compiler', async () => {
          const response = await req.get(`/static-two/${hashTwo}/bundle.js`);

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to nonexistent file for the second compiler', async () => {
          const response = await req.get(`/static-two/${hashTwo}/invalid.js`);

          expect(response.statusCode).toEqual(404);
          expect(response.headers["content-type"]).toEqual(
            get404ContentTypeHeader(name),
          );
        });

        it('should return "404" code for GET request to the "public" path for the second compiler', async () => {
          const response = await req.get(`/static-two/${hashTwo}/`);

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to the "index" option for the second compiler', async () => {
          const response = await req.get(`/static-two/${hashTwo}/index.html`);

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
        });
      });

      describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode with difference "publicPath" and "path"', () => {
        beforeAll(async () => {
          const compiler = getCompiler(webpackMultiConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file for the first compiler', async () => {
          const response = await req.get("/static-one/bundle.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to nonexistent file for the first compiler', async () => {
          const response = await req.get("/static-one/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the "public" path for the first compiler', async () => {
          const response = await req.get("/static-one/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the "index" option for the first compiler', async () => {
          const response = await req.get("/static-one/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the second bundle file', async () => {
          const response = await req.get("/static-two/bundle.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to nonexistent file for the second compiler', async () => {
          const response = await req.get("/static-two/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the "public" path for the second compiler', async () => {
          const response = await req.get("/static-two/");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the "index" option for the second compiler', async () => {
          const response = await req.get("/static-two/index.html");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to nonexistent file', async () => {
          const response = await req.get("/static/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
        });
      });

      describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode with same "publicPath"', () => {
        beforeAll(async () => {
          const compiler = getCompiler([
            {
              ...webpackMultiConfig[0],
              output: {
                filename: "bundle-one.js",
                path: path.resolve(__dirname, "./outputs/array/static-one"),
                publicPath: "/my-public/",
              },
            },
            {
              ...webpackMultiConfig[1],
              output: {
                filename: "bundle-two.js",
                path: path.resolve(__dirname, "./outputs/array/static-two"),
                publicPath: "/my-public/",
              },
            },
          ]);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file for the first compiler', async () => {
          const response = await req.get("/my-public/bundle-one.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "200" code for GET request to the bundle file for the second compiler', async () => {
          const response = await req.get("/my-public/bundle-two.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to nonexistent file', async () => {
          const response = await req.get("/my-public/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the "public" path', async () => {
          const response = await req.get("/my-public/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the "index" option', async () => {
          const response = await req.get("/my-public/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to nonexistent file', async () => {
          const response = await req.get("/static/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
        });
      });

      describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode with same "path"', () => {
        beforeAll(async () => {
          const compiler = getCompiler([
            {
              ...webpackMultiConfig[0],
              output: {
                filename: "bundle-one.js",
                path: path.resolve(__dirname, "./outputs/array/static-one"),
                publicPath: "/one-public/",
              },
            },
            {
              ...webpackMultiConfig[1],
              output: {
                filename: "bundle-two.js",
                path: path.resolve(__dirname, "./outputs/array/static-one"),
                publicPath: "/two-public/",
              },
            },
          ]);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file for the first compiler', async () => {
          const response = await req.get("/one-public/bundle-one.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to nonexistent file to the first bundle file', async () => {
          const response = await req.get("/one-public/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the "public" path for the first compiler', async () => {
          const response = await req.get("/one-public/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the "index" option for the first compiler', async () => {
          const response = await req.get("/one-public/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the bundle file for the second compiler', async () => {
          const response = await req.get("/two-public/bundle-two.js");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to nonexistent file to the second bundle file', async () => {
          const response = await req.get("/two-public/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "200" code for GET request to the "public" path for the second compiler', async () => {
          const response = await req.get("/two-public/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "200" code for GET request to the "index" option for the second compiler', async () => {
          const response = await req.get("/two-public/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to nonexistent file', async () => {
          const response = await req.get("/static/invalid");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
        });
      });

      describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode, when the "output.publicPath" option presented in only one configuration (in first)', () => {
        beforeAll(async () => {
          const compiler = getCompiler(webpackClientServerConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file', async () => {
          const response = await req.get("/static/bundle.js");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to nonexistent file', async () => {
          const response = await req.get("/static/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to the public path', async () => {
          const response = await req.get("/static/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to the "index" option', async () => {
          const response = await req.get("/static/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
        });
      });

      describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode, when the "output.publicPath" option presented in only one configuration (in second)', () => {
        beforeAll(async () => {
          const compiler = getCompiler([
            webpackClientServerConfig[1],
            webpackClientServerConfig[0],
          ]);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file', async () => {
          const response = await req.get("/static/bundle.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to nonexistent file', async () => {
          const response = await req.get("/static/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to the public path', async () => {
          const response = await req.get("/static/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to the "index" option', async () => {
          const response = await req.get("/static/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
        });
      });

      describe('should respect "output.publicPath" and "output.path" options in multi-compiler mode, when the "output.publicPath" option presented in only one configuration with same "path"', () => {
        beforeAll(async () => {
          const compiler = getCompiler([
            {
              ...webpackClientServerConfig[0],
              output: {
                filename: "bundle-one.js",
                path: path.resolve(__dirname, "./outputs/client-server/same"),
                publicPath: "/static/",
              },
            },
            {
              ...webpackClientServerConfig[1],
              output: {
                filename: "bundle-two.js",
                path: path.resolve(__dirname, "./outputs/client-server/same"),
              },
            },
          ]);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return "200" code for GET request to the bundle file', async () => {
          const response = await req.get("/static/bundle-one.js");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "404" code for GET request to a nonexistent file', async () => {
          const response = await req.get("/static/invalid.js");

          expect(response.statusCode).toEqual(404);
        });

        it('should return "404" code for GET request to the public path', async () => {
          const response = await req.get("/static/");

          expect(response.statusCode).toEqual(200);
        });

        it('should return "200" code for GET request to the non-public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return "404" code for GET request to the "index" option', async () => {
          const response = await req.get("/static/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });
      });

      describe("should handle an earlier request if a change happened while compiling", () => {
        beforeAll(async () => {
          const compiler = getCompiler(webpackConfig);

          let invalidated = false;

          compiler.hooks.afterDone.tap("Invalidated", () => {
            if (!invalidated) {
              instance.invalidate();

              invalidated = true;
            }
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the bundle file', async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);
        });
      });

      describe("should handle custom fs errors and response 500 code", () => {
        let compiler;

        const outputPath = path.resolve(
          __dirname,
          "./outputs/basic-test-errors-500",
        );

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "image.svg"),
            "svg image",
          );

          instance.context.outputFileSystem.createReadStream =
            function createReadStream(...args) {
              const brokenStream = new this.ReadStream(...args);

              // eslint-disable-next-line no-underscore-dangle
              brokenStream._read = function _read() {
                this.emit("error", new Error("test"));
                this.end();
                this.destroy();
              };

              return brokenStream;
            };
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "500" code for the "GET" request to the "image.svg" file', async () => {
          const response = await req.get("/image.svg").set("Range", "bytes=0-");

          expect(response.statusCode).toEqual(500);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(response.text).toEqual(
            "<!DOCTYPE html>\n" +
              '<html lang="en">\n' +
              "<head>\n" +
              '<meta charset="utf-8">\n' +
              "<title>Error</title>\n" +
              "</head>\n" +
              "<body>\n" +
              "<pre>Internal Server Error</pre>\n" +
              "</body>\n" +
              "</html>",
          );
        });
      });

      describe("should handle known fs errors and response 404 code", () => {
        let compiler;

        const outputPath = path.resolve(
          __dirname,
          "./outputs/basic-test-errors-404",
        );

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "image.svg"),
            "svg image",
          );

          instance.context.outputFileSystem.createReadStream =
            function createReadStream(...args) {
              const brokenStream = new this.ReadStream(...args);

              // eslint-disable-next-line no-underscore-dangle
              brokenStream._read = function _read() {
                const error = new Error("test");

                error.code = "ENAMETOOLONG";

                this.emit("error", error);
                this.end();
                this.destroy();
              };

              return brokenStream;
            };
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "404" code for the "GET" request to the "image.svg" file', async () => {
          const response = await req.get("/image.svg").set("Range", "bytes=0-");

          expect(response.statusCode).toEqual(404);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(response.text).toEqual(
            "<!DOCTYPE html>\n" +
              '<html lang="en">\n' +
              "<head>\n" +
              '<meta charset="utf-8">\n' +
              "<title>Error</title>\n" +
              "</head>\n" +
              "<body>\n" +
              "<pre>Not Found</pre>\n" +
              "</body>\n" +
              "</html>",
          );
        });
      });

      describe("should work without `fs.createReadStream`", () => {
        let compiler;
        let codeContent;

        const outputPath = path.resolve(
          __dirname,
          "./outputs/basic-test-no-createReadStream",
        );

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });
          compiler.hooks.afterCompile.tap("wdm-test", (params) => {
            codeContent = params.assets["bundle.js"].source();
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "image.svg"),
            "svg image",
          );

          instance.context.outputFileSystem.createReadStream = null;
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the bundle file', async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            String(Buffer.byteLength(codeContent)),
          );
          expect(response.headers["content-type"]).toEqual(
            "application/javascript; charset=utf-8",
          );
          expect(response.text).toEqual(codeContent);
        });

        it('should return the "200" code for the "GET" request to the "image.svg" file', async () => {
          const fileData = instance.context.outputFileSystem.readFileSync(
            path.resolve(outputPath, "image.svg"),
          );

          const response = await req.get("/image.svg");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            fileData.byteLength.toString(),
          );
          expect(response.headers["content-type"]).toEqual("image/svg+xml");
        });

        it('should return the "200" code for the "HEAD" request to the "image.svg" file', async () => {
          const fileData = instance.context.outputFileSystem.readFileSync(
            path.resolve(outputPath, "image.svg"),
          );

          const response = await req.head("/image.svg");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-length"]).toEqual(
            fileData.byteLength.toString(),
          );
          expect(response.headers["content-type"]).toEqual("image/svg+xml");
          expect(response.body).toEqual({});
        });
      });
    });

    describe("mimeTypes option", () => {
      describe('should set the correct value for "Content-Type" header to known MIME type', () => {
        beforeAll(async () => {
          const outputPath = path.resolve(__dirname, "./outputs/basic");
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "file.html"),
            "welcome",
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to "file.html"', async () => {
          const response = await req.get("/file.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(response.text).toEqual("welcome");
        });
      });

      describe('should set the correct value for "Content-Type" header to specified MIME type', () => {
        beforeAll(async () => {
          const outputPath = path.resolve(__dirname, "./outputs/basic");
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              mimeTypes: {
                myhtml: "text/html",
              },
            },
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "file.myhtml"),
            "welcome",
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request "file.phtml"', async () => {
          const response = await req.get("/file.myhtml");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(response.text).toEqual("welcome");
        });
      });

      describe('should override value for "Content-Type" header for known MIME type', () => {
        beforeAll(async () => {
          const outputPath = path.resolve(__dirname, "./outputs/basic");
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              mimeTypes: {
                jpg: "image/vnd.test+jpeg",
              },
            },
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "file.jpg"),
            "welcome",
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request "file.jpg"', async () => {
          const response = await req.get("/file.jpg");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "image/vnd.test+jpeg",
          );
        });
      });

      describe('should not set "Content-Type" header for route not from outputFileSystem', () => {
        beforeAll(async () => {
          const outputPath = path.resolve(__dirname, "./outputs/basic");
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              mimeTypes: {
                jpg: "image/vnd.test+jpeg",
              },
            },
            {
              setupMiddlewares: (middlewares) => {
                applyTestMiddleware(name, middlewares);

                return middlewares;
              },
            },
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request "file.jpg" with default content type', async () => {
          const response = await req.get("/file.jpg");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toMatch(/text\/html/);
        });
      });
    });

    describe("mimeTypeDefault option", () => {
      describe('should set the correct value for "Content-Type" header to unknown MIME type', () => {
        beforeAll(async () => {
          const outputPath = path.resolve(__dirname, "./outputs/basic");
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              mimeTypeDefault: "text/plain",
            },
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "file.unknown"),
            "welcome",
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to "file.html"', async () => {
          const response = await req.get("/file.unknown");

          expect(response.statusCode).toEqual(200);
          expect(
            response.headers["content-type"].startsWith("text/plain"),
          ).toBe(true);
          expect(response.text).toEqual("welcome");
        });
      });
    });

    describe("watchOptions option", () => {
      describe("should work without value", () => {
        let compiler;
        let spy;

        beforeAll(async () => {
          compiler = getCompiler(webpackConfig);
          spy = jest.spyOn(compiler, "watch");

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          spy.mockRestore();

          await close(server, instance);
        });

        it('should pass arguments to the "watch" method', async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy.mock.calls[0][0]).toEqual({});
        });
      });

      describe("should respect options from the configuration", () => {
        let compiler;
        let spy;

        beforeAll(async () => {
          compiler = getCompiler(webpackWatchOptionsConfig);

          spy = jest.spyOn(compiler, "watch");

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          spy.mockRestore();

          await close(server, instance);
        });

        it('should pass arguments to the "watch" method', async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy.mock.calls[0][0]).toEqual({
            aggregateTimeout: 300,
            poll: true,
          });
        });
      });

      describe("should respect options from the configuration in multi-compile mode", () => {
        let compiler;
        let spy;

        beforeAll(async () => {
          compiler = getCompiler(webpackMultiWatchOptionsConfig);

          spy = jest.spyOn(compiler, "watch");

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          spy.mockRestore();

          await close(server, instance);
        });

        it('should pass arguments to the "watch" method', async () => {
          const response1 = await req.get("/static-one/bundle.js");

          expect(response1.statusCode).toEqual(200);

          const response2 = await req.get("/static-two/bundle.js");

          expect(response2.statusCode).toEqual(200);
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy.mock.calls[0][0]).toEqual([
            { aggregateTimeout: 800, poll: false },
            { aggregateTimeout: 300, poll: true },
          ]);
        });
      });
    });

    describe("writeToDisk option", () => {
      describe('should work with "true" value', () => {
        let compiler;

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: path.resolve(__dirname, "./outputs/write-to-disk-true"),
              publicPath: "/public/",
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            { writeToDisk: true },
          );
        });

        afterAll(async () => {
          del.sync(
            path.posix.resolve(__dirname, "./outputs/write-to-disk-true"),
          );

          await close(server, instance);
        });

        it("should find the bundle file on disk", (done) => {
          request(app)
            .get("/public/bundle.js")
            .expect(200, (error) => {
              if (error) {
                return done(error);
              }

              const bundlePath = path.resolve(
                __dirname,
                "./outputs/write-to-disk-true/bundle.js",
              );

              expect(
                compiler.hooks.assetEmitted.taps.filter(
                  (hook) => hook.name === "DevMiddleware",
                ).length,
              ).toBe(1);
              expect(fs.existsSync(bundlePath)).toBe(true);

              instance.invalidate();

              return compiler.hooks.done.tap(
                "DevMiddlewareWriteToDiskTest",
                () => {
                  expect(
                    compiler.hooks.assetEmitted.taps.filter(
                      (hook) => hook.name === "DevMiddleware",
                    ).length,
                  ).toBe(1);

                  done();
                },
              );
            });
        });

        it("should not allow to get files above root", async () => {
          const response = await req.get("/public/..%2f../middleware.test.js");

          expect(response.statusCode).toEqual(403);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(response.text).toEqual(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Forbidden</pre>
</body>
</html>`);
        });
      });

      describe('should work with "true" value when the `output.clean` is `true`', () => {
        const outputPath = path.resolve(
          __dirname,
          "./outputs/write-to-disk-true-with-clean",
        );

        let compiler;

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackConfig,
            output: {
              clean: true,
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            { writeToDisk: true },
          );

          fs.mkdirSync(outputPath, {
            recursive: true,
          });
          fs.writeFileSync(path.resolve(outputPath, "test.json"), "{}");
        });

        afterAll(async () => {
          del.sync(outputPath);

          await close(server, instance);
        });

        it("should find the bundle file on disk", (done) => {
          request(app)
            .get("/bundle.js")
            .expect(200, (error) => {
              if (error) {
                return done(error);
              }

              const bundlePath = path.resolve(outputPath, "bundle.js");

              expect(fs.existsSync(path.resolve(outputPath, "test.json"))).toBe(
                false,
              );

              expect(
                compiler.hooks.assetEmitted.taps.filter(
                  (hook) => hook.name === "DevMiddleware",
                ).length,
              ).toBe(1);
              expect(fs.existsSync(bundlePath)).toBe(true);

              instance.invalidate();

              return compiler.hooks.done.tap(
                "DevMiddlewareWriteToDiskTest",
                () => {
                  expect(
                    compiler.hooks.assetEmitted.taps.filter(
                      (hook) => hook.name === "DevMiddleware",
                    ).length,
                  ).toBe(1);

                  done();
                },
              );
            });
        });
      });

      describe('should work with "false" value', () => {
        let compiler;

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: path.resolve(__dirname, "./outputs/write-to-disk-false"),
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            { writeToDisk: false },
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it("should not find the bundle file on disk", (done) => {
          request(app)
            .get("/bundle.js")
            .expect(200, (error) => {
              if (error) {
                return done(error);
              }

              const bundlePath = path.resolve(
                __dirname,
                "./outputs/write-to-disk-false/bundle.js",
              );

              expect(
                compiler.hooks.assetEmitted.taps.filter(
                  (hook) => hook.name === "DevMiddleware",
                ).length,
              ).toBe(0);
              expect(fs.existsSync(bundlePath)).toBe(false);

              instance.invalidate();

              return compiler.hooks.done.tap(
                "DevMiddlewareWriteToDiskTest",
                () => {
                  expect(
                    compiler.hooks.assetEmitted.taps.filter(
                      (hook) => hook.name === "DevMiddleware",
                    ).length,
                  ).toBe(0);

                  done();
                },
              );
            });
        });
      });

      describe('should work with "Function" value when it returns "true"', () => {
        let compiler;

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: path.resolve(
                __dirname,
                "./outputs/write-to-disk-function-true",
              ),
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              writeToDisk: (filePath) => /bundle\.js$/.test(filePath),
            },
          );
        });

        afterAll(async () => {
          del.sync(
            path.posix.resolve(
              __dirname,
              "./outputs/write-to-disk-function-true",
            ),
          );

          await close(server, instance);
        });

        it("should find the bundle file on disk", async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);

          const bundlePath = path.resolve(
            __dirname,
            "./outputs/write-to-disk-function-true/bundle.js",
          );

          expect(fs.existsSync(bundlePath)).toBe(true);
        });
      });

      describe('should work with "Function" value when it returns "false"', () => {
        let compiler;

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: path.resolve(
                __dirname,
                "./outputs/write-to-disk-function-false",
              ),
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              writeToDisk: (filePath) => !/bundle\.js$/.test(filePath),
            },
          );
        });

        afterAll(async () => {
          del.sync(
            path.posix.resolve(
              __dirname,
              "./outputs/write-to-disk-function-false",
            ),
          );

          await close(server, instance);
        });

        it("should not find the bundle file on disk", async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);

          const bundlePath = path.resolve(
            __dirname,
            "./outputs/write-to-disk-function-false/bundle.js",
          );

          expect(fs.existsSync(bundlePath)).toBe(false);
        });
      });

      describe("should work when assets have query string", () => {
        let compiler;

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackQueryStringConfig,
            output: {
              filename: "bundle.js?[contenthash]",
              path: path.resolve(
                __dirname,
                "./outputs/write-to-disk-query-string",
              ),
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            { writeToDisk: true },
          );
        });

        afterAll(async () => {
          del.sync(
            path.posix.resolve(
              __dirname,
              "./outputs/write-to-disk-query-string",
            ),
          );

          await close(server, instance);
        });

        it("should find the bundle file on disk with no querystring", async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);

          const bundlePath = path.resolve(
            __dirname,
            "./outputs/write-to-disk-query-string/bundle.js",
          );

          expect(fs.existsSync(bundlePath)).toBe(true);
        });
      });

      describe("should work in multi-compiler mode", () => {
        let compiler;

        beforeAll(async () => {
          compiler = getCompiler([
            {
              ...webpackMultiWatchOptionsConfig[0],
              output: {
                filename: "bundle.js",
                path: path.resolve(
                  __dirname,
                  "./outputs/write-to-disk-multi-compiler/static-one",
                ),
                publicPath: "/static-one/",
              },
            },
            {
              ...webpackMultiWatchOptionsConfig[1],
              output: {
                filename: "bundle.js",
                path: path.resolve(
                  __dirname,
                  "./outputs/write-to-disk-multi-compiler/static-two",
                ),
                publicPath: "/static-two/",
              },
            },
          ]);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            { writeToDisk: true },
          );
        });

        afterAll(async () => {
          del.sync(
            path.posix.resolve(
              __dirname,
              "./outputs/write-to-disk-multi-compiler/",
            ),
          );

          await close(server, instance);
        });

        it("should find the bundle files on disk", async () => {
          const response1 = await req.get("/static-one/bundle.js");

          expect(response1.statusCode).toEqual(200);

          const response2 = await req.get("/static-two/bundle.js");

          expect(response2.statusCode).toEqual(200);

          const bundleFiles = [
            "./outputs/write-to-disk-multi-compiler/static-one/bundle.js",
            "./outputs/write-to-disk-multi-compiler/static-one/index.html",
            "./outputs/write-to-disk-multi-compiler/static-one/svg.svg",
            "./outputs/write-to-disk-multi-compiler/static-two/bundle.js",
          ];

          for (const bundleFile of bundleFiles) {
            const bundlePath = path.resolve(__dirname, bundleFile);

            expect(fs.existsSync(bundlePath)).toBe(true);
          }
        });
      });

      describe('should work with "[hash]"/"[fullhash]" in the "output.path" and "output.publicPath" option', () => {
        let compiler;
        let hash;

        beforeAll(async () => {
          compiler = getCompiler({
            ...webpackConfig,
            ...{
              output: {
                filename: "bundle.js",
                publicPath: "/static/[fullhash]/",
                path: path.resolve(
                  __dirname,
                  "./outputs/write-to-disk-with-hash/dist_[fullhash]",
                ),
              },
            },
          });
          compiler.hooks.afterCompile.tap("wdm-test", ({ hash: h }) => {
            hash = h;
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            { writeToDisk: true },
          );

          await new Promise((resolve) => {
            const interval = setInterval(() => {
              if (hash) {
                clearInterval(interval);

                resolve();
              }
            }, 10);
          });
        });

        afterAll(async () => {
          del.sync(
            path.posix.resolve(__dirname, "./outputs/write-to-disk-with-hash/"),
          );

          await close(server, instance);
        });

        it("should find the bundle file on disk", async () => {
          const response = await req.get(`/static/${hash}/bundle.js`);

          expect(response.statusCode).toEqual(200);

          const bundlePath = path.resolve(
            __dirname,
            `./outputs/write-to-disk-with-hash/dist_${hash}/bundle.js`,
          );

          expect(fs.existsSync(bundlePath)).toBe(true);
        });
      });
    });

    describe("methods option", () => {
      let compiler;

      beforeAll(async () => {
        compiler = getCompiler(webpackConfig);

        [server, req, instance] = await frameworkFactory(
          name,
          framework,
          compiler,
          {
            methods: ["POST"],
            publicPath: "/public/",
          },
        );
      });

      afterAll(async () => {
        await close(server, instance);
      });

      it('should return the "200" code for the "POST" request to the bundle file', async () => {
        const response = await req.post(`/public/bundle.js`);

        expect(response.statusCode).toEqual(200);
      });

      it('should return the "404" code for the "GET" request to the bundle file', async () => {
        const response = await req.get(`/public/bundle.js`);

        expect(response.statusCode).toEqual(404);
      });

      it('should return the "200" code for the "HEAD" request to the bundle file', async () => {
        const response = await req.head(`/public/bundle.js`);

        expect(response.statusCode).toEqual(404);
      });
    });

    describe("headers option", () => {
      describe("works with object", () => {
        beforeEach(async () => {
          const compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              headers: { "X-nonsense-1": "yes", "X-nonsense-2": "no" },
            },
            {
              setupMiddlewares: (middlewares) => {
                applyTestMiddleware(name, middlewares);

                return middlewares;
              },
            },
          );
        });

        afterEach(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the bundle file and return headers', async () => {
          const response = await req.get(`/bundle.js`);

          expect(response.statusCode).toEqual(200);
          expect(response.headers["x-nonsense-1"]).toEqual("yes");
          expect(response.headers["x-nonsense-2"]).toEqual("no");
        });

        it('should return the "200" code for the "GET" request to path not in outputFileSystem but not return headers', async () => {
          const res = await request(app).get("/file.jpg");
          expect(res.statusCode).toEqual(200);
          expect(res.headers["X-nonsense-1"]).toBeUndefined();
          expect(res.headers["X-nonsense-2"]).toBeUndefined();
        });
      });

      describe("works with array of objects", () => {
        beforeEach(async () => {
          const compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              headers: [
                {
                  key: "X-Foo",
                  value: "value1",
                },
                {
                  key: "X-Bar",
                  value: "value2",
                },
              ],
            },
            {
              setupMiddlewares: (middlewares) => {
                applyTestMiddleware(name, middlewares);

                return middlewares;
              },
            },
          );
        });

        afterEach(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the bundle file and return headers', async () => {
          const response = await req.get(`/bundle.js`);

          expect(response.statusCode).toEqual(200);
          expect(response.headers["x-foo"]).toEqual("value1");
          expect(response.headers["x-bar"]).toEqual("value2");
        });

        it('should return the "200" code for the "GET" request to path not in outputFileSystem but not return headers', async () => {
          const res = await request(app).get("/file.jpg");
          expect(res.statusCode).toEqual(200);
          expect(res.headers["x-foo"]).toBeUndefined();
          expect(res.headers["x-bar"]).toBeUndefined();
        });
      });

      describe("works with function", () => {
        beforeEach(async () => {
          const compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              headers: () => {
                return { "X-nonsense-1": "yes", "X-nonsense-2": "no" };
              },
            },
            {
              setupMiddlewares: (middlewares) => {
                applyTestMiddleware(name, middlewares);

                return middlewares;
              },
            },
          );
        });

        afterEach(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the bundle file and return headers', async () => {
          const response = await req.get(`/bundle.js`);

          expect(response.statusCode).toEqual(200);
          expect(response.headers["x-nonsense-1"]).toEqual("yes");
          expect(response.headers["x-nonsense-2"]).toEqual("no");
        });

        it('should return the "200" code for the "GET" request to path not in outputFileSystem but not return headers', async () => {
          const res = await req.get("/file.jpg");
          expect(res.statusCode).toEqual(200);
          expect(res.headers["X-nonsense-1"]).toBeUndefined();
          expect(res.headers["X-nonsense-2"]).toBeUndefined();
        });
      });

      describe("works with function returning an array", () => {
        beforeEach(async () => {
          const compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              headers: () => [
                {
                  key: "X-Foo",
                  value: "value1",
                },
                {
                  key: "X-Bar",
                  value: "value2",
                },
              ],
            },
            {
              setupMiddlewares: (middlewares) => {
                applyTestMiddleware(name, middlewares);

                return middlewares;
              },
            },
          );
        });

        afterEach(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the bundle file and return headers', async () => {
          const response = await req.get(`/bundle.js`);

          expect(response.statusCode).toEqual(200);
          expect(response.headers["x-foo"]).toEqual("value1");
          expect(response.headers["x-bar"]).toEqual("value2");
        });

        it('should return the "200" code for the "GET" request to path not in outputFileSystem but not return headers', async () => {
          const res = await req.get("/file.jpg");
          expect(res.statusCode).toEqual(200);
          expect(res.headers["x-foo"]).toBeUndefined();
          expect(res.headers["x-bar"]).toBeUndefined();
        });
      });

      describe("works with headers function with params", () => {
        beforeEach(async () => {
          const compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              // eslint-disable-next-line no-unused-vars, no-shadow
              headers: (req, res, context) => {
                res.setHeader("X-nonsense-1", "yes");
                res.setHeader("X-nonsense-2", "no");
              },
            },
            {
              setupMiddlewares: (middlewares) => {
                applyTestMiddleware(name, middlewares);

                return middlewares;
              },
            },
          );
        });

        afterEach(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the bundle file and return headers', async () => {
          const response = await req.get(`/bundle.js`);

          expect(response.statusCode).toEqual(200);
          expect(response.headers["x-nonsense-1"]).toEqual("yes");
          expect(response.headers["x-nonsense-2"]).toEqual("no");
        });

        it('should return the "200" code for the "GET" request to path not in outputFileSystem but not return headers', async () => {
          const res = await req.get("/file.jpg");
          expect(res.statusCode).toEqual(200);
          expect(res.headers["X-nonsense-1"]).toBeUndefined();
          expect(res.headers["X-nonsense-2"]).toBeUndefined();
        });
      });
    });

    describe("publicPath option", () => {
      describe('should work with "string" value', () => {
        beforeAll(async () => {
          const compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            { publicPath: "/public/" },
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the bundle file', async () => {
          const response = await req.get(`/public/bundle.js`);

          expect(response.statusCode).toEqual(200);
        });
      });

      describe('should work with "auto" value', () => {
        beforeAll(async () => {
          const compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            { publicPath: "auto" },
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the bundle file', async () => {
          const response = await req.get("/bundle.js");

          expect(response.statusCode).toEqual(200);
        });
      });
    });

    describe("serverSideRender option", () => {
      let locals;

      beforeAll(async () => {
        const compiler = getCompiler(webpackConfig);

        [server, req, instance] = await frameworkFactory(
          name,
          framework,
          compiler,
          { serverSideRender: true },
          {
            setupMiddlewares: (middlewares) => {
              if (name === "hapi") {
                middlewares.push({
                  plugin: {
                    name: "myPlugin",
                    version: "1.0.0",
                    register(innerServer) {
                      innerServer.route({
                        method: "GET",
                        path: "/foo/bar",
                        handler(innerReq) {
                          // eslint-disable-next-line prefer-destructuring
                          locals = innerReq.raw.res.locals;

                          return "welcome";
                        },
                      });
                    },
                  },
                });
              } else {
                middlewares.push((_req, res) => {
                  // eslint-disable-next-line prefer-destructuring
                  locals = res.locals;

                  // Express API
                  if (res.sendStatus) {
                    res.sendStatus(200);
                  }
                  // Connect API
                  else {
                    // eslint-disable-next-line no-param-reassign
                    res.statusCode = 200;
                    res.end();
                  }
                });
              }

              return middlewares;
            },
          },
        );
      });

      afterAll(async () => {
        await close(server, instance);
      });

      it('should return the "200" code for the "GET" request', async () => {
        const response = await req.get("/foo/bar");

        expect(response.statusCode).toEqual(200);
        expect(locals.webpack.devMiddleware).toBeDefined();
      });
    });

    describe("outputFileSystem option", () => {
      describe("should work with an unspecified value", () => {
        let compiler;

        beforeAll(async () => {
          compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should use the "memfs" package by default', () => {
          const { Stats } = memfs;

          expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
          expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
            Stats,
          );
        });
      });

      describe("should work with the configured value (native fs)", () => {
        let compiler;

        beforeAll(async () => {
          compiler = getCompiler(webpackConfig);

          const configuredFs = fs;

          configuredFs.join = path.join.bind(path);
          configuredFs.mkdirp = () => {};

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              outputFileSystem: configuredFs,
            },
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it("should use the configurated output filesystem", () => {
          const { Stats } = fs;

          expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
          expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
            Stats,
          );
          expect(compiler.outputFileSystem).toHaveProperty("join");
          expect(compiler.outputFileSystem).toHaveProperty("mkdirp");
        });
      });

      describe("should work with the configured value (memfs)", () => {
        let compiler;

        beforeAll(async () => {
          compiler = getCompiler(webpackConfig);

          const configuredFs = createFsFromVolume(new Volume());

          configuredFs.join = path.join.bind(path);
          configuredFs.mkdirp = () => {};

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              outputFileSystem: configuredFs,
            },
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it("should use the configured output filesystem", () => {
          const { Stats } = memfs;

          expect(new compiler.outputFileSystem.Stats()).toBeInstanceOf(Stats);
          expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
            Stats,
          );
          expect(compiler.outputFileSystem).toHaveProperty("join");
          expect(compiler.outputFileSystem).toHaveProperty("mkdirp");
          expect(compiler.outputFileSystem).toHaveProperty("mkdirSync");
        });
      });

      describe("should work with the configured value in multi-compiler mode (native fs)", () => {
        let compiler;

        beforeAll(async () => {
          compiler = getCompiler(webpackMultiConfig);

          const configuredFs = fs;

          configuredFs.join = path.join.bind(path);
          configuredFs.mkdirp = () => {};

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              outputFileSystem: configuredFs,
            },
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it("should use configured output filesystems", () => {
          const { Stats } = fs;

          for (const childCompiler of compiler.compilers) {
            expect(new childCompiler.outputFileSystem.Stats()).toBeInstanceOf(
              Stats,
            );
            expect(childCompiler.outputFileSystem).toHaveProperty("join");
            expect(childCompiler.outputFileSystem).toHaveProperty("mkdirp");
          }

          expect(new instance.context.outputFileSystem.Stats()).toBeInstanceOf(
            Stats,
          );
          expect(instance.context.outputFileSystem).toHaveProperty("join");
          expect(instance.context.outputFileSystem).toHaveProperty("mkdirp");
        });
      });
    });

    describe("index option", () => {
      describe('should work with "false" value', () => {
        beforeAll(async () => {
          const compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            { index: false, publicPath: "/" },
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "404" code for the "GET" request to the public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
          expect(response.headers["content-type"]).toEqual(
            get404ContentTypeHeader(name),
          );
        });

        it('should return the "200" code for the "GET" request to the "index.html" file', async () => {
          const response = await req.get("/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });
      });

      describe('should work with "true" value', () => {
        beforeAll(async () => {
          const compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            { index: true, publicPath: "/" },
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });

        it('should return the "200" code for the "GET" request to the public path', async () => {
          const response = await req.get("/index.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });
      });

      describe('should work with "string" value', () => {
        beforeAll(async () => {
          const outputPath = path.resolve(__dirname, "./outputs/basic");
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              index: "default.html",
              publicPath: "/",
            },
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "default.html"),
            "hello",
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });
      });

      describe('should work with "string" value with a custom extension', () => {
        beforeAll(async () => {
          const outputPath = path.resolve(__dirname, "./outputs/basic");
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              index: "index.custom",
              publicPath: "/",
            },
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "index.custom"),
            "hello",
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(200);
        });
      });

      describe('should work with "string" value with a custom extension and defined a custom MIME type', () => {
        beforeAll(async () => {
          const outputPath = path.resolve(__dirname, "./outputs/basic");
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              index: "index.mycustom",
              mimeTypes: {
                mycustom: "text/html",
              },
              publicPath: "/",
            },
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "index.mycustom"),
            "hello",
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
        });
      });

      describe('should work with "string" value without an extension', () => {
        beforeAll(async () => {
          const outputPath = path.resolve(__dirname, "./outputs/basic");
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            { index: "noextension" },
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "noextension"),
            "hello",
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "200" code for the "GET" request to the public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(200);
        });
      });

      describe('should work with "string" value but the "index" option is a directory', () => {
        beforeAll(async () => {
          const outputPath = path.resolve(__dirname, "./outputs/basic");
          const compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              index: "custom.html",
              publicPath: "/",
            },
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.mkdirSync(
            path.resolve(outputPath, "custom.html"),
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it('should return the "404" code for the "GET" request to the public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
        });
      });

      describe("should not handle request when index is neither a file nor a directory", () => {
        let compiler;
        let isDirectory;

        beforeAll(async () => {
          compiler = getCompiler(webpackConfig);

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              index: "default.html",
              publicPath: "/",
            },
          );

          isDirectory = jest
            .spyOn(instance.context.outputFileSystem, "statSync")
            .mockImplementation(() => {
              return {
                isFile: () => false,
                isDirectory: () => false,
              };
            });
        });

        afterAll(async () => {
          isDirectory.mockRestore();

          await close(server, instance);
        });

        it('should return the "404" code for the "GET" request to the public path', async () => {
          const response = await req.get("/");

          expect(response.statusCode).toEqual(404);
        });
      });
    });

    describe("modifyResponseData option", () => {
      describe("should work", () => {
        let compiler;

        beforeAll(async () => {
          const outputPath = path.resolve(
            __dirname,
            "./outputs/modify-response-data",
          );

          compiler = getCompiler({
            ...webpackConfig,
            output: {
              filename: "bundle.js",
              path: outputPath,
            },
          });

          [server, req, instance] = await frameworkFactory(
            name,
            framework,
            compiler,
            {
              modifyResponseData: () => {
                const result = Buffer.from("test");

                return { data: result, byteLength: result.length };
              },
            },
          );

          instance.context.outputFileSystem.mkdirSync(outputPath, {
            recursive: true,
          });
          instance.context.outputFileSystem.writeFileSync(
            path.resolve(outputPath, "file.html"),
            "welcome",
          );
        });

        afterAll(async () => {
          await close(server, instance);
        });

        it("should modify file", async () => {
          const response = await req.get("/file.html");

          expect(response.statusCode).toEqual(200);
          expect(response.headers["content-type"]).toEqual(
            "text/html; charset=utf-8",
          );
          expect(response.text).toEqual("test");
        });
      });
    });
  });
});
