const crypto = require("node:crypto");

/** @typedef {import("./index").IncomingMessage} IncomingMessage */
/** @typedef {import("./index").ServerResponse} ServerResponse */
/** @typedef {import("./index").OutputFileSystem} OutputFileSystem */
/** @typedef {import("./index").EXPECTED_ANY} EXPECTED_ANY */

const matchHtmlRegExp = /["'&<>]/;

/**
 * @param {string} string raw HTML
 * @returns {string} escaped HTML
 */
function escapeHtml(string) {
  const str = `${string}`;
  const match = matchHtmlRegExp.exec(str);

  if (!match) {
    return str;
  }

  let escape;
  let html = "";
  let index = 0;
  let lastIndex = 0;

  for ({ index } = match; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      // "
      case 34:
        escape = "&quot;";
        break;
      // &
      case 38:
        escape = "&amp;";
        break;
      // '
      case 39:
        escape = "&#39;";
        break;
      // <
      case 60:
        escape = "&lt;";
        break;
      // >
      case 62:
        escape = "&gt;";
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      // eslint-disable-next-line unicorn/prefer-string-slice
      html += str.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  // eslint-disable-next-line unicorn/prefer-string-slice
  return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
}

/** @typedef {import("fs").Stats} Stats */
/** @typedef {import("fs").ReadStream} ReadStream */

/**
 * Generate a tag for a stat.
 * @param {Stats} stats stats
 * @returns {{ hash: string, buffer?: Buffer }} etag
 */
function statTag(stats) {
  const mtime = stats.mtime.getTime().toString(16);
  const size = stats.size.toString(16);

  return { hash: `W/"${size}-${mtime}"` };
}

/**
 * Generate an entity tag.
 * @param {Buffer | ReadStream} entity entity
 * @returns {Promise<{ hash: string, buffer?: Buffer }>} etag
 */
async function entityTag(entity) {
  const sha1 = crypto.createHash("sha1");

  if (!Buffer.isBuffer(entity)) {
    let byteLength = 0;

    /** @type {Buffer[]} */
    const buffers = [];

    await new Promise((resolve, reject) => {
      entity
        .on("data", (chunk) => {
          sha1.update(chunk);
          buffers.push(/** @type {Buffer} */ (chunk));
          byteLength += /** @type {Buffer} */ (chunk).byteLength;
        })
        .on("end", () => {
          resolve(sha1);
        })
        .on("error", reject);
    });

    return {
      buffer: Buffer.concat(buffers),
      hash: `"${byteLength.toString(16)}-${sha1.digest("base64").slice(0, 27)}"`,
    };
  }

  if (entity.byteLength === 0) {
    // Fast-path empty
    return { hash: '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"' };
  }

  // Compute hash of entity
  const hash = sha1.update(entity).digest("base64").slice(0, 27);

  // Compute length of entity
  const { byteLength } = entity;

  return { hash: `"${byteLength.toString(16)}-${hash}"` };
}

/**
 * Create a simple ETag.
 * @param {Buffer | ReadStream | Stats} entity entity
 * @returns {Promise<{ hash: string, buffer?: Buffer }>} etag
 */
async function etag(entity) {
  const isStrong =
    Buffer.isBuffer(entity) ||
    typeof (/** @type {ReadStream} */ (entity).pipe) === "function";

  return isStrong
    ? entityTag(/** @type {Buffer | ReadStream} */ (entity))
    : statTag(/** @type {import("fs").Stats} */ (entity));
}

const cacheStore = new WeakMap();

/**
 * @template T
 * @typedef {(...args: EXPECTED_ANY) => T} FunctionReturning
 */

/**
 * @template T
 * @param {FunctionReturning<T>} fn memorized function
 * @param {({ cache?: Map<string, { data: T }> } | undefined)=} cache cache
 * @param {((value: T) => T)=} callback callback
 * @returns {FunctionReturning<T>} new function
 */
function memorize(fn, { cache = new Map() } = {}, callback = undefined) {
  /**
   * @param {EXPECTED_ANY[]} arguments_ args
   * @returns {EXPECTED_ANY} result
   */
  const memoized = (...arguments_) => {
    const [key] = arguments_;
    const cacheItem = cache.get(key);

    if (cacheItem) {
      return cacheItem.data;
    }

    // @ts-expect-error
    let result = fn.apply(this, arguments_);

    if (callback) {
      result = callback(result);
    }

    cache.set(key, {
      data: result,
    });

    return result;
  };

  cacheStore.set(memoized, cache);

  return memoized;
}

/**
 * Parse a HTTP token list.
 * @param {string} str str
 * @returns {string[]} tokens
 */
function parseTokenList(str) {
  let end = 0;
  let start = 0;

  const list = [];

  // gather tokens
  for (let i = 0, len = str.length; i < len; i++) {
    switch (str.charCodeAt(i)) {
      case 0x20 /*   */:
        if (start === end) {
          end = i + 1;
          start = end;
        }
        break;
      case 0x2c /* , */:
        if (start !== end) {
          list.push(str.slice(start, end));
        }
        end = i + 1;
        start = end;
        break;
      default:
        end = i + 1;
        break;
    }
  }

  // final token
  if (start !== end) {
    list.push(str.slice(start, end));
  }

  return list;
}

/**
 * @typedef {object} ExpectedIncomingMessage
 * @property {((name: string) => string | string[] | undefined)=} getHeader get header extra method
 * @property {(() => string | undefined)=} getMethod get method extra method
 * @property {(() => string | undefined)=} getURL get URL extra method
 * @property {string=} originalUrl an extra option for `fastify` (and `@fastify/express`) to get original URL
 */

/**
 * @typedef {object} ExpectedServerResponse
 * @property {((status: number) => void)=} setStatusCode set status code
 * @property {(() => number)=} getStatusCode get status code
 * @property {((name: string) => string | string[] | undefined | number)} getHeader get header
 * @property {((name: string, value: number | string | Readonly<string[]>) => ExpectedServerResponse)=} setHeader set header
 * @property {((name: string) => void)=} removeHeader remove header
 * @property {((data: string | Buffer) => void)=} send send
 * @property {((data?: string | Buffer) => void)=} finish finish
 * @property {(() => string[])=} getResponseHeaders get response header
 * @property {(() => boolean)=} getHeadersSent get headers sent
 * @property {((data: EXPECTED_ANY) => void)=} stream stream
 * @property {(() => EXPECTED_ANY)=} getOutgoing get outgoing
 * @property {((name: string, value: EXPECTED_ANY) => void)=} setState set state
 */

/**
 * @template {IncomingMessage & ExpectedIncomingMessage} Request
 * @param {Request} req req
 * @param {string} name name
 * @returns {string | string[] | undefined} request header
 */
function getRequestHeader(req, name) {
  // Pseudo API
  if (typeof req.getHeader === "function") {
    return req.getHeader(name);
  }

  return req.headers[name];
}

/**
 * @template {IncomingMessage & ExpectedIncomingMessage} Request
 * @param {Request} req req
 * @returns {string | undefined} request method
 */
function getRequestMethod(req) {
  // Pseudo API
  if (typeof req.getMethod === "function") {
    return req.getMethod();
  }

  return req.method;
}

/**
 * @template {IncomingMessage & ExpectedIncomingMessage} Request
 * @param {Request} req req
 * @returns {string | undefined} request URL
 */
function getRequestURL(req) {
  // Pseudo API
  if (typeof req.getURL === "function") {
    return req.getURL();
  }
  // Fastify decodes URI by default, Our logic is based on encoded URI
  else if (typeof req.originalUrl !== "undefined") {
    return req.originalUrl;
  }

  return req.url;
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {number} code code
 * @returns {void}
 */
function setStatusCode(res, code) {
  // Pseudo API
  if (typeof res.setStatusCode === "function") {
    res.setStatusCode(code);

    return;
  }

  // Node.js API

  res.statusCode = code;
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @returns {number} status code
 */
function getStatusCode(res) {
  // Pseudo API
  if (typeof res.getStatusCode === "function") {
    return res.getStatusCode();
  }

  return res.statusCode;
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {string} name name
 * @returns {string | string[] | undefined | number} header
 */
function getResponseHeader(res, name) {
  // Real and Pseudo API
  return res.getHeader(name);
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {string} name name
 * @param {number | string | Readonly<string[]>} value value
 * @returns {Response} response
 */
function setResponseHeader(res, name, value) {
  // Real and Pseudo API
  return res.setHeader(name, value);
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {string} name name
 * @returns {void}
 */
function removeResponseHeader(res, name) {
  // Real and Pseudo API
  res.removeHeader(name);
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @returns {string[]} header names
 */
function getResponseHeaders(res) {
  // Pseudo API
  if (typeof res.getResponseHeaders === "function") {
    return res.getResponseHeaders();
  }

  return res.getHeaderNames();
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @returns {boolean} true when headers were sent, otherwise false
 */
function getHeadersSent(res) {
  // Pseudo API
  if (typeof res.getHeadersSent === "function") {
    return res.getHeadersSent();
  }

  return res.headersSent;
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {import("fs").ReadStream} bufferOrStream buffer or stream
 */
function pipe(res, bufferOrStream) {
  // Pseudo API and Koa API
  if (typeof res.stream === "function") {
    // Writable stream into Readable stream
    res.stream(bufferOrStream);
    return;
  }

  // Node.js API and Express API and Hapi API
  bufferOrStream.pipe(res);
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {string | Buffer} bufferOrString buffer or string
 * @returns {void}
 */
function send(res, bufferOrString) {
  // Pseudo API and Express API and Koa API
  if (typeof res.send === "function") {
    res.send(bufferOrString);
    return;
  }

  res.end(bufferOrString);
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {(string | Buffer)=} data data
 */
function finish(res, data) {
  // Pseudo API and Express API and Koa API
  if (typeof res.finish === "function") {
    res.finish(data);
    return;
  }

  // Pseudo API and Express API and Koa API
  res.end(data);
}

/**
 * @param {string} filename filename
 * @param {OutputFileSystem} outputFileSystem output file system
 * @param {number} start start
 * @param {number} end end
 * @returns {{ bufferOrStream: (Buffer | import("fs").ReadStream), byteLength: number }} result with buffer or stream and byte length
 */
function createReadStreamOrReadFileSync(
  filename,
  outputFileSystem,
  start,
  end,
) {
  /** @type {string | Buffer | import("fs").ReadStream} */
  let bufferOrStream;
  /** @type {number} */
  let byteLength;

  // Stream logic
  const isFsSupportsStream =
    typeof outputFileSystem.createReadStream === "function";

  if (isFsSupportsStream) {
    bufferOrStream =
      /** @type {import("fs").createReadStream} */
      (outputFileSystem.createReadStream)(filename, {
        start,
        end,
      });

    // Handle files with zero bytes
    byteLength = end === 0 ? 0 : end - start + 1;
  } else {
    bufferOrStream = outputFileSystem.readFileSync(filename);
    ({ byteLength } = bufferOrStream);
  }

  return { bufferOrStream, byteLength };
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @returns {Response} res res
 */
function getOutgoing(res) {
  // Pseudo API and Express API and Koa API
  if (typeof res.getOutgoing === "function") {
    return res.getOutgoing();
  }

  return res;
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 */
function initState(res) {
  if (typeof res.setState === "function") {
    return;
  }

  // fixes #282. credit @cexoso. in certain edge situations res.locals is undefined.
  res.locals ||= {};
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res res
 * @param {string} name name
 * @param {EXPECTED_ANY} value state
 * @returns {void}
 */
function setState(res, name, value) {
  if (typeof res.setState === "function") {
    res.setState(name, value);

    return;
  }

  /** @type {Record<string, EXPECTED_ANY>} */
  (res.locals)[name] = value;
}

module.exports = {
  createReadStreamOrReadFileSync,
  escapeHtml,
  etag,
  finish,
  getHeadersSent,
  getOutgoing,
  getRequestHeader,
  getRequestMethod,
  getRequestURL,
  getResponseHeader,
  getResponseHeaders,
  getStatusCode,
  initState,
  memorize,
  parseTokenList,
  pipe,
  removeResponseHeader,
  send,
  setResponseHeader,
  setState,
  setStatusCode,
};
