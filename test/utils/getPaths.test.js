import path from "path";

import express from "express";

import middleware from "../../src";
import getPaths from "../../src/utils/getPaths";

import getCompiler from "../helpers/getCompiler";
import listenAndCompile from "../helpers/listenAndCompile";
import webpackSimpleConfig from "../fixtures/webpack.simple.config";
import webpackPublicPathConfig from "../fixtures/webpack.public-path.config";
import webpackMultiConfig from "../fixtures/webpack.array.config";
import isWebpack5 from "../helpers/isWebpack5";

// Suppress unnecessary stats output
global.console.log = jest.fn();

describe("getPaths", () => {
  const configs = [
    {
      title: "simple config",
      config: webpackSimpleConfig,
      expected: [
        {
          outputPath: path.resolve(__dirname, "../outputs/simple"),
          publicPath: isWebpack5() ? "auto" : "",
        },
      ],
    },
    {
      title: "publicPath config",
      config: webpackPublicPathConfig,
      expected: [
        {
          outputPath: path.resolve(__dirname, "../outputs/public-path"),
          publicPath: "/public/path/",
        },
      ],
    },
    {
      title: "multi config",
      config: webpackMultiConfig,
      expected: [
        {
          outputPath: path.resolve(__dirname, "../outputs/array/js1"),
          publicPath: "/static-one/",
        },
        {
          outputPath: path.resolve(__dirname, "../outputs/array/js2"),
          publicPath: "/static-two/",
        },
      ],
    },
  ];

  configs.forEach((config) => {
    describe(config.title, () => {
      let instance;
      let listen;
      let app;
      let compiler;

      beforeEach((done) => {
        compiler = getCompiler(config.config);

        instance = middleware(compiler);

        app = express();
        app.use(instance);

        listen = listenAndCompile(app, compiler, done);
      });

      afterEach((done) => {
        if (instance) {
          instance.close();
        }

        if (listen) {
          listen.close(done);
        } else {
          done();
        }
      });

      it("should return correct paths", () => {
        expect(getPaths(instance.context)).toEqual(config.expected);
      });
    });
  });
});
