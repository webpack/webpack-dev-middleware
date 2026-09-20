import validateOptions from "../src/options.check";

// `validation-options.test.js` drives the option corpus through `middleware()`,
// which catches a validator that wrongly *accepts* invalid options. It cannot
// see one that wrongly *rejects* valid options: validation falls back to the
// real schema, which accepts them, so every test still passes while the
// startup cost this validator exists to avoid comes back. These assertions are
// what notices that.
describe("precompiled options validator", () => {
  const valid = [
    ["empty options", {}],
    ["mimeTypes", { mimeTypes: { phtml: ["text/html"] } }],
    ["writeToDisk as a boolean", { writeToDisk: true }],
    ["writeToDisk as a function", { writeToDisk: () => true }],
    ["methods", { methods: ["GET", "HEAD"] }],
    ["headers as an object", { headers: { "X-Custom": "value" } }],
    ["headers as an array", { headers: [{ key: "X-Custom", value: "v" }] }],
    ["headers as a function", { headers: () => ({}) }],
    ["publicPath as a string", { publicPath: "/assets/" }],
    ["publicPath as auto", { publicPath: "auto" }],
    ["stats as a boolean", { stats: false }],
    ["stats as a string", { stats: "minimal" }],
    ["serverSideRender", { serverSideRender: true }],
    ["index as a string", { index: "index.html" }],
    ["etag", { etag: "weak" }],
    ["lastModified", { lastModified: true }],
    ["cacheControl as a number", { cacheControl: 1000 }],
    ["modifyResponseData", { modifyResponseData: () => ({}) }],
  ];

  for (const [name, options] of valid) {
    it(`should accept ${name} without falling back`, () => {
      expect(validateOptions(options)).toBe(true);
    });
  }

  const invalid = [
    ["an unknown property", { unknownOption: true }],
    ["a wrongly typed option", { writeToDisk: {} }],
    ["a value outside an enum", { etag: "whoops!" }],
    ["a bad publicPath", { publicPath: 1 }],
    ["a non-function where a function is required", { modifyResponseData: 1 }],
    ["a bad mimeTypes", { mimeTypes: "foo" }],
  ];

  for (const [name, options] of invalid) {
    it(`should reject ${name}`, () => {
      expect(validateOptions(options)).toBe(false);
    });
  }
});
