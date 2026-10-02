// Everything the middleware needs that is not the middleware itself: the
// framework shims, the response helpers, the CORS rules for the hot endpoint,
// the media-type table and the client injection.
//
// One module rather than five. These were all loaded on every require of this
// package anyway — `index.js` and `hot.js` pulled each of them in at the top —
// so folding them together drops four module resolutions without changing what
// gets parsed. The parts that are genuinely conditional are not here: the
// WebSocket server is required when a `ws` transport is built, and `mime-db`
// when the first type is looked up.

const crypto = require("node:crypto");
const path = require("node:path");

/** @typedef {import("./index").IncomingMessage} IncomingMessage */
/** @typedef {import("./index").ServerResponse} ServerResponse */
/** @typedef {import("./index").OutputFileSystem} OutputFileSystem */
/** @typedef {import("./index").EXPECTED_ANY} EXPECTED_ANY */
/** @typedef {import("./index").Logger} Logger */

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
 * Parse an HTTP Date into a number.
 * @param {string} date date
 * @returns {number} timestamp
 */
function parseHttpDate(date) {
  const timestamp = date && Date.parse(date);

  // istanbul ignore next: guard against date.js Date.parse patching
  return typeof timestamp === "number" ? timestamp : Number.NaN;
}

/**
 * @param {"bytes"} type type
 * @param {number} size size
 * @param {import("range-parser").Range=} range range
 * @returns {string} value of content range header
 */
function getValueContentRangeHeader(type, size, range) {
  return `${type} ${range ? `${range.start}-${range.end}` : "*"}/${size}`;
}

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

// These caches are keyed by request data — a url, or a `Range` header — so
// the key space is only as bounded as what clients send. Without a limit a
// long-running server keeps every key it has ever seen, so the cache is an
// LRU: enough to serve a project's assets, capped for everything else.
const DEFAULT_MAX_CACHE_SIZE = 1000;

/**
 * @template T
 * @param {FunctionReturning<T>} fn memorized function
 * @param {({ cache?: Map<string, { data: T }>, maxSize?: number } | undefined)=} cache cache
 * @param {((value: T) => T)=} callback callback
 * @returns {FunctionReturning<T>} new function
 * @throws {TypeError} when `maxSize` is not a positive integer
 */
function memorize(
  fn,
  { cache = new Map(), maxSize = DEFAULT_MAX_CACHE_SIZE } = {},
  callback = undefined,
) {
  // A non-positive or fractional limit would never evict, or never terminate below.
  if (!Number.isInteger(maxSize) || maxSize < 1) {
    throw new TypeError("The 'maxSize' option must be a positive integer.");
  }

  /**
   * @param {EXPECTED_ANY[]} arguments_ args
   * @returns {EXPECTED_ANY} result
   */
  const memoized = (...arguments_) => {
    const [key] = arguments_;
    const cacheItem = cache.get(key);

    if (cacheItem) {
      // Re-inserting moves the key to the end of the map's insertion order,
      // which is what makes the first key the least recently used one.
      cache.delete(key);
      cache.set(key, cacheItem);

      return cacheItem.data;
    }

    // @ts-expect-error
    let result = fn.apply(this, arguments_);

    if (callback) {
      result = callback(result);
    }

    // A loop, because a caller-supplied cache can start out over the limit.
    while (cache.size >= maxSize) {
      cache.delete(/** @type {string} */ (cache.keys().next().value));
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
 * @property {string=} id an extra option for `fastify` (and `@fastify/express`) to get ID of request
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
  // Fastify decodes URI by default, our logic is based on encoded URI.
  // `req.url` may be modified by middleware (e.g. connect-history-api-fallback), in which case we use req.url instead.
  // `req.id` is a special property of `fastify`
  else if (req.id && req.originalUrl) {
    try {
      if (req.url === decodeURI(req.originalUrl)) {
        return req.originalUrl;
      }
    } catch {
      // decodeURI can throw on malformed sequences, fall through
    }
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
function createReadStreamOrReadFile(filename, outputFileSystem, start, end) {
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

    byteLength = end === 0 ? 0 : end - start + 1;
  } else {
    bufferOrStream = outputFileSystem.readFileSync(filename);
    ({ byteLength } = bufferOrStream);

    byteLength = bufferOrStream.byteLength;
  }

  return { bufferOrStream, byteLength };
}

/**
 * @param {import("fs").ReadStream} stream stream
 * @param {boolean} suppress do need suppress?
 * @returns {void}
 */
function destroyStream(stream, suppress) {
  if (stream.destroyed) {
    return;
  }

  stream.destroy();

  if (typeof stream.addListener === "function" && suppress) {
    stream.removeAllListeners("error");
    stream.addListener("error", () => {});
  }
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

// Convert a Node.js `Readable` into a Web `ReadableStream` ourselves so we can
// hand it to Hono in a form `@hono/node-server` fast-paths through
// `responseViaCache` -> `writeFromReadableStream`. Avoids Node's internal
// `Readable.toWeb` adapter, which races on late `error`/`close` events from
// `fs.ReadStream` and throws "Invalid state: ReadableStream already closed"
// (notably on Windows + Node 20). All controller transitions are guarded.
// TODO remove this helper (and its use in honoWrapper) when the upstream race
// is fixed and the minimum supported Node version no longer reproduces it:
//   - https://github.com/honojs/node-server/issues/233
//   - https://github.com/honojs/node-server/pull/299
/**
 * @param {import("fs").ReadStream} stream node readable stream
 * @returns {ReadableStream<Uint8Array>} web readable stream
 */
function nodeReadableToWebStream(stream) {
  // ReadableStream has been a global since Node 16.5 and is stable in practice
  // since Node 18; eslint-plugin-n flags it as experimental.
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  return new ReadableStream({
    start(controller) {
      let closed = false;
      /** @type {() => void} */
      let cleanup;

      /**
       * @param {Buffer | string} chunk chunk
       */
      const onData = (chunk) => {
        if (closed) return;
        try {
          controller.enqueue(
            chunk instanceof Uint8Array ? chunk : Buffer.from(chunk),
          );
        } catch {
          // Controller already closed/errored; nothing to do.
        }
        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          stream.pause();
        }
      };
      const onEnd = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
      /**
       * @param {Error} err err
       */
      const onError = (err) => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.error(err);
        } catch {
          // Already closed/errored.
        }
      };
      cleanup = () => {
        stream.off("data", onData);
        stream.off("end", onEnd);
        stream.off("error", onError);
      };

      // Stream may have already finished by the time we wrap it (empty file
      // path resolved on the `end` event in `res.stream`).
      if (stream.readableEnded || stream.destroyed) {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
        return;
      }

      stream.on("data", onData);
      stream.once("end", onEnd);
      stream.once("error", onError);
    },
    pull() {
      if (typeof stream.resume === "function") {
        stream.resume();
      }
    },
    cancel(reason) {
      if (typeof stream.destroy === "function") {
        stream.destroy(reason instanceof Error ? reason : undefined);
      }
    },
  });
}

// --------------------------------------------------------------------------
// CORS, for the hot endpoint
//
// Who may reach the event stream or open a WebSocket to it. The middleware
// decides the default here because it writes the header itself; the policy is
// the server's, through `hot.cors`.
// --------------------------------------------------------------------------

/** @typedef {import("./hot.js").CorsOption} CorsOption */
/** @typedef {import("./hot.js").CorsOrigin} CorsOrigin */

// Only the machine the build is running on: `localhost` and anything under it,
// `127.0.0.1` and `[::1]`, on any port and either scheme. A page on another
// port of the same machine is the one cross-origin case that is normal in
// development, and nothing a remote site can be served from matches this. The
// same set, and the same reasoning, as Vite's `server.cors` default.
//
// Anchored at both ends on purpose: `http://localhost.evil.example` must not
// read as a local origin.
const CORS_LOCAL_ORIGINS =
  /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

// A secret the injected client carries and the endpoint requires, so reaching
// the stream takes something a page has to have been given rather than a
// header a browser may or may not send.
//
// Why a secret and not a better header check: `cors` is answered by `Origin`,
// and the `Origin`/`Sec-Fetch-*` family is absent entirely when the
// destination is not potentially trustworthy — plain `http` to anything but
// `localhost`. webpack-dev-server shipped two fixes built on those headers and
// both were bypassed that way (CVE-2026-6402, then CVE-2026-14620). A token
// does not ask the browser to volunteer anything.
//
// What it does not do: the client reads it from its entry query, so it is a
// string in the bundle. An attacker who can already read the bundle
// cross-origin — the same plain-`http`-to-a-LAN-address case, where nothing
// sets `Cross-Origin-Resource-Policy` — reads the token with it. Closing that
// needs the response header and a host allowlist, which belong to whoever owns
// the server. This hardens every case where the bundle is not readable, and is
// defence in depth in the case where it is.
//
// Off by default on BOTH transports, because requiring one by default breaks
// a client the middleware did not inject — and `inject` being on does not mean
// a client was injected. An entry is skipped when every entry point already
// pulls the client in (the developer wired it themselves, which the README
// documents), when `hot.transport` is a function, and for a non-web target.
// In each of those the endpoint would demand a token nothing had been given,
// and every client would be refused with a `403`.
//
// TODO in the next major release default both to `true`, alongside the `cors`
// default above, and hand the token to a client the middleware did not inject
// some way that does not depend on the entry query.
const HOT_DEFAULT_TOKEN = false;

/**
 * The resolved answer to "may this origin read the stream": no origin may, any
 * origin may, or ask this.
 * @typedef {false | "*" | ((origin: string) => boolean)} CorsGrant
 */

/**
 * Does one origin match what the `cors` option allows?
 * @param {string} origin the origin the request carried
 * @param {CorsOrigin} allowed what the option allows
 * @returns {boolean} true when the origin is allowed
 */
function matchOrigin(origin, allowed) {
  if (typeof allowed === "function") {
    return Boolean(allowed(origin));
  }

  if (typeof allowed === "string") {
    return allowed === "*" || allowed === origin;
  }

  if (Array.isArray(allowed)) {
    for (const each of allowed) {
      if (matchOrigin(origin, each)) {
        return true;
      }
    }

    return false;
  }

  // `test()` on a `g` or `y` pattern leaves `lastIndex` at the end of the
  // match, and the option is resolved once and reused for every request — so
  // the next request from the same origin would start matching mid-string and
  // be refused, alternating allowed and not. Only those two flags read
  // `lastIndex`, so only they need it reset.
  if (allowed.global || allowed.sticky) {
    allowed.lastIndex = 0;
  }

  return allowed.test(origin);
}

/**
 * Read the `cors` option once, so each request costs a call rather than a walk
 * back through every form the option can take.
 * @param {CorsOption} cors the option, as it was given, or the transport's default when it was not
 * @returns {CorsGrant} the resolved answer
 */
function resolveCors(cors) {
  if (cors === false || cors === true) {
    return cors && "*";
  }

  // `{ origin }`, as Vite and `expressjs/cors` are configured, so a
  // configuration written for one of those reads the same here.
  const allowed =
    typeof cors === "object" &&
    !Array.isArray(cors) &&
    !(cors instanceof RegExp)
      ? cors.origin
      : cors;

  if (allowed === false || typeof allowed === "undefined") {
    return false;
  }

  if (allowed === "*") {
    return "*";
  }

  // `origin: true` reflects whatever asked, which is how `expressjs/cors`
  // reads it — every origin, but named rather than wildcarded.
  if (allowed === true) {
    return () => true;
  }

  return (origin) => matchOrigin(origin, allowed);
}

/**
 * Is this request's origin the one it was sent to?
 *
 * The middleware never knows the url it is mounted under, so its own origin is
 * only ever readable from the request: whatever answered is whatever the client
 * addressed. Both sides carry the port when it is not the scheme's default, so
 * they are compared as they arrived.
 * @param {IncomingMessage} req the request
 * @param {string} origin the `Origin` it carried
 * @returns {boolean} true when the two are the same origin
 */
function isSameOrigin(req, origin) {
  try {
    // `"null"` — what a sandboxed frame or a `file:` page sends — does not
    // parse, and so is never the same origin as anything.
    return new URL(origin).host === getRequestHeader(req, "host");
  } catch {
    return false;
  }
}

/**
 * Add the cross-origin grant the `cors` option asks for, if any.
 *
 * Without a grant the browser will not hand a cross-origin `EventSource`
 * response to the page, which is what keeps a build's errors — module paths and
 * the source frames webpack puts in a parse error — from being readable by any
 * site the developer happens to have open. Nothing is rejected: the request is
 * answered either way, and the browser decides what to do with it.
 *
 * No same-origin case to handle here, unlike an upgrade: a browser sends no
 * `Origin` at all for a same-origin `EventSource`, and would not consult these
 * headers if it did.
 * @param {CorsGrant} grant the resolved grant
 * @param {IncomingMessage} req the request joining the stream
 * @param {Record<string, string>} headers the response headers, added to in place
 */
function applyCors(grant, req, headers) {
  if (grant === false) {
    return;
  }

  if (grant === "*") {
    headers["Access-Control-Allow-Origin"] = "*";
    return;
  }

  // The header names a single origin, so the request's own is echoed back when
  // it is an allowed one. `Vary` goes out either way: without it a cache that
  // kept this response could hand it to a page on another origin, grant and
  // all.
  headers.Vary = "Origin";

  // Through the framework abstraction: a request does not always carry
  // `headers` of its own — under Hono it answers `getHeader` instead, and
  // reading the property straight off it grants nothing to anyone.
  const origin = getRequestHeader(req, "origin");

  if (typeof origin === "string" && grant(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
}

/**
 * May this WebSocket handshake go ahead?
 *
 * A handshake is not subject to CORS — a browser sends `Origin` and pays no
 * attention to what comes back — so the same option can only be honoured here
 * by refusing the upgrade. Two cases are allowed whatever the option says,
 * because neither is a page on another origin reading the stream.
 *
 * A request with no `Origin` at all is not a browser: browsers always send one
 * on a handshake, while a Node client, a proxy's health check or a test
 * harness does not, and refusing those would break them for nothing.
 *
 * A request whose `Origin` is the one it was addressed to is the page the
 * middleware is serving. `EventSource` gets this for free, since the browser
 * knows a same-origin read needs no grant; an upgrade has to work it out.
 * @param {CorsGrant} grant the resolved grant
 * @param {IncomingMessage} req the request being upgraded
 * @returns {boolean} true when the upgrade may proceed
 */
function isUpgradeAllowed(grant, req) {
  const origin = getRequestHeader(req, "origin");

  if (typeof origin !== "string") {
    return true;
  }

  if (isSameOrigin(req, origin)) {
    return true;
  }

  if (grant === false) {
    return false;
  }

  return grant === "*" || grant(origin);
}

/**
 * The token the endpoint will require, if any.
 * @param {boolean | string | undefined} option the `hot.token` option
 * @returns {string | false} the token, or false when the endpoint requires none
 */
function resolveToken(option) {
  // A token of your own, for a consumer that has to be able to construct the
  // url without being handed one — a script, or a client you wrote.
  if (typeof option === "string") {
    return option.length > 0 ? option : false;
  }

  const wanted = option ?? HOT_DEFAULT_TOKEN;

  if (!wanted) {
    return false;
  }

  // 9 bytes rather than a round 8 or 16: `base64url` encodes it without
  // padding, so the query carries 12 characters and no `=`. The same size Vite
  // and Rsbuild use for theirs.
  return crypto.randomBytes(9).toString("base64url");
}

/**
 * Does a url's pathname match an expected path exactly?
 *
 * Pathname only: the hot endpoint is reached with a query on it — the client's
 * options, and the token — and with a fragment from a page that has one.
 * @param {string | undefined} url url
 * @param {string} expected expected pathname
 * @returns {boolean} true when the url pathname matches the expected path
 */
function pathMatch(url, expected) {
  if (!url) return false;

  try {
    return new URL(url, "http://localhost").pathname === expected;
  } catch {
    return false;
  }
}

/**
 * Does the request carry the token the endpoint requires?
 *
 * Compared in constant time. The comparison is not a plausible oracle — a
 * token lives for one run of one dev server — but a length-dependent early
 * return would be the kind of thing a reader has to reason about, and
 * `timingSafeEqual` costs nothing here.
 * @param {string | false} expected the resolved token, or false when none is required
 * @param {IncomingMessage} req the request
 * @returns {boolean} true when the request may proceed
 */
function isTokenValid(expected, req) {
  if (expected === false) {
    return true;
  }

  let given;

  try {
    given = new URL(
      /** @type {string} */ (req.url),
      "http://localhost",
    ).searchParams.get("token");
  } catch {
    return false;
  }

  if (typeof given !== "string") {
    return false;
  }

  const a = Buffer.from(given);
  const b = Buffer.from(expected);

  // `timingSafeEqual` throws on a length mismatch rather than returning false,
  // and the length of the expected token is not a secret.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --------------------------------------------------------------------------
// Media types
//
// Extension to media type, from `mime-db` directly.
// --------------------------------------------------------------------------

// Extension to media type, straight from `mime-db`.
//
// This was `mime-types`, which is `mime-db` plus the table and the scoring
// below. Two reasons to own them instead:
//
//   * `mime-db` is what webpack already depends on, so a webpack project has
//     it installed either way. Going through `mime-types` added a package to
//     every install and a second version range over the same data.
//   * the `mimeTypes` option used to be applied by assigning to the shared
//     `mime-types` module's own table, which is process-wide: two middleware
//     instances accumulated into one map rather than keeping their own, and
//     anything else in the process using `mime-types` inherited whatever a
//     middleware had registered. A table per instance is what the option
//     always meant.
//
// The scoring is `jshttp/mime-types`' own, so an extension resolves to exactly
// what it did before — `test/mimeTypes.test.js` holds that to every extension
// in `mime-db`.

// Described here rather than imported from `@types/mime-db`, so the
// declarations this package publishes do not ask consumers for a package only
// its own build needs.
/** @typedef {{ source?: string, charset?: string, compressible?: boolean, extensions?: readonly string[] }} MimeDbEntry */

// Facets, from RFC 6838 section 3: a vendor or personal subtype is less
// official than a plain one.
/** @type {Record<string, number>} */
const FACET_SCORES = {
  "prs.": 100,
  "x-": 200,
  "x.": 300,
  "vnd.": 400,
  default: 900,
};

/** @type {Record<string, number>} */
const SOURCE_SCORES = {
  nginx: 10,
  apache: 20,
  iana: 40,
  // What `mime-db` added itself.
  default: 30,
};

/** @type {Record<string, number>} */
const TYPE_SCORES = {
  // `application/xml` over `text/xml`, `application/rtf` over `text/rtf`.
  application: 1,
  // `font/woff` over `application/font-woff`.
  font: 2,
  // `video/mp4` over `audio/mp4` over `application/mp4`, per RFC 4337.
  audio: 2,
  video: 3,
  default: 0,
};

const EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:[;\s]|$)/;
const TEXT_TYPE_REGEXP = /^text\//i;

/**
 * How official a media type is. The higher the score the more it is preferred
 * where two types claim the same extension.
 * @param {string} mimeType the media type
 * @param {string=} source where `mime-db` got it from
 * @returns {number} the score
 */
function mimeScore(mimeType, source = "default") {
  if (mimeType === "application/octet-stream") {
    return 0;
  }

  const [type, subtype] = mimeType.split("/");
  const facet = subtype.replace(/([.]|x-).*/, "$1");

  // All else equal, the shorter type wins.
  return (
    (FACET_SCORES[facet] || FACET_SCORES.default) +
    (SOURCE_SCORES[source] || SOURCE_SCORES.default) +
    (TYPE_SCORES[type] || TYPE_SCORES.default) +
    (1 - mimeType.length / 100)
  );
}

/** @type {{ db: Record<string, MimeDbEntry>, types: Record<string, string> } | undefined} */
let tables;

/**
 * The extension table, built once and only when something asks for a type.
 * `mime-db` is a megabyte of JSON, and a build that never serves a file over
 * HTTP — `writeToDisk` on its own, a plugin run — should not pay to parse it.
 * @returns {{ db: Record<string, MimeDbEntry>, types: Record<string, string> }} the database and the extension table
 */
function getTables() {
  if (tables) {
    return tables;
  }

  /** @type {Record<string, MimeDbEntry>} */
  const db = require("mime-db");

  /** @type {Record<string, string>} */
  const types = Object.create(null);

  for (const type of Object.keys(db)) {
    const { extensions } = db[type];

    if (!extensions || extensions.length === 0) {
      continue;
    }

    for (const extension of extensions) {
      const current = types[extension];

      types[extension] =
        (current ? mimeScore(current, db[current].source) : 0) >
        mimeScore(type, db[type].source)
          ? current
          : type;
    }
  }

  tables = { db, types };

  return tables;
}

/**
 * @typedef {object} MimeTypes
 * @property {(file: string) => string | false} lookup the media type an extension, a `.extension`, or a path resolves to
 * @property {(type: string) => string | false} charset the charset a media type is served as
 * @property {(str: string) => string | false} contentType a `Content-Type` value for a media type or an extension
 */

/**
 * The lookup an instance uses, with the `mimeTypes` option over the top of the
 * known extensions rather than written into them.
 * @param {Record<string, string>=} extra extension to media type, from the `mimeTypes` option
 * @returns {MimeTypes} the lookup
 */
function createMimeTypes(extra) {
  // Copied, not held: the option used to be spread into a table once, so the
  // object a caller passed stopped mattering the moment the middleware was
  // built, and two instances given the same object could not reach each
  // other through it. A null prototype so `constructor` and `toString` are
  // not extensions anything resolves to.
  const registered = extra
    ? Object.assign(Object.create(null), extra)
    : undefined;

  /**
   * The media type an extension, a `.extension`, or a whole path resolves to.
   * @param {string} file extension, `.extension`, or path
   * @returns {string | false} the media type, or false when none is known
   */
  const lookup = (file) => {
    if (!file || typeof file !== "string") {
      return false;
    }

    // The `x.` prefix makes one expression cover all three spellings:
    // `js`, `.js` and `/a/b.js`.
    const extension = path.extname(`x.${file}`).toLowerCase().slice(1);

    if (!extension) {
      return false;
    }

    // The option first: registering an extension is how it is overridden.
    if (registered && registered[extension] !== undefined) {
      return registered[extension];
    }

    return getTables().types[extension] || false;
  };

  /**
   * The charset a media type is served as, where one is known.
   * @param {string} type the media type
   * @returns {string | false} the charset, or false
   */
  const charset = (type) => {
    if (!type || typeof type !== "string") {
      return false;
    }

    const match = EXTRACT_TYPE_REGEXP.exec(type);
    const entry = match && getTables().db[match[1].toLowerCase()];

    if (entry && entry.charset) {
      return entry.charset;
    }

    // Text is UTF-8 unless `mime-db` says otherwise. Spelled the way
    // `mime-db` spells it, since this is returned to callers and not only
    // used to build a header.
    if (match && TEXT_TYPE_REGEXP.test(match[1])) {
      // eslint-disable-next-line unicorn/text-encoding-identifier-case
      return "UTF-8";
    }

    return false;
  };

  /**
   * A `Content-Type` value for a media type, an extension, or a path — the
   * type with its charset where there is one.
   * @param {string} str media type, extension, `.extension`, or path
   * @returns {string | false} the header value, or false when no type is known
   */
  const contentType = (str) => {
    if (!str || typeof str !== "string") {
      return false;
    }

    const type = str.includes("/") ? str : lookup(str);

    if (!type) {
      return false;
    }

    if (type.includes("charset")) {
      return type;
    }

    const found = charset(type);

    return found ? `${type}; charset=${found.toLowerCase()}` : type;
  };

  return { charset, contentType, lookup };
}

// --------------------------------------------------------------------------
// Client injection
//
// Putting the browser runtime and `HotModuleReplacementPlugin` into the
// compilation, so `hot` is the whole of what a configuration needs.
// --------------------------------------------------------------------------

/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("./hot.js").HotOptions} HotOptions */
/** @typedef {import("./hot.js").ClientStreamFactory<EXPECTED_ANY>} ClientStreamFactory */

/**
 * The browser runtime, as it is published. Resolved when it is needed rather
 * than at load, so requiring this module in a checkout that has not been built
 * does not throw.
 * @returns {string} absolute path to the client entry
 */
function clientEntry() {
  return path.join(__dirname, "..", "client", "index.js");
}

/**
 * Whether a compiler produces something a browser will run, which is the whole
 * of what decides where the client goes.
 *
 * `platform` answers it for every target webpack resolves one from: `web` is
 * true for `web`, `webworker`, `electron-renderer`, `electron-preload`, `nwjs`,
 * `deno` and a browserslist query, and false for `node`, `async-node`,
 * `electron-main` and a `nodeXX` version. A target that names no platform at
 * all — `target: false`, or a bare `es2020` — leaves nothing to go on and gets
 * no client; add the entry yourself there.
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when the client belongs in this compilation
 */
function isWebTarget(compiler) {
  const { platform } = /** @type {EXPECTED_ANY} */ (compiler);

  // Deno has no `window`, and whether it has the transports is not something
  // this suite can answer. Matched as itself: a universal target that includes
  // it reports `null` here and still runs in a browser.
  // TODO include Deno once it can be tested there.
  if (platform.deno === true) {
    return false;
  }

  // A universal target (`target: ["node", "web"]`) is `null` for both, which
  // `target: false` also is — hence the guard for it.
  // TODO drop the third clause once the `webpack` peer range starts at
  // ^5.108.0, which added `platform.universal`.
  return Boolean(
    platform.web ||
    platform.universal ||
    (compiler.options.target !== false &&
      platform.web === null &&
      platform.node === null),
  );
}

// How the hot client is asked for by package name. Exact, because the package
// exports other things under `client/` — `client/ws`, `client/overlay` — and
// none of those connects to anything.
const CLIENT_PACKAGE_REQUEST = "webpack-dev-middleware/client";

// The same file asked for by path: as published, and as it is in this
// repository, which is how its own tests reach it.
const CLIENT_FILES = [
  path.join(__dirname, "..", "client", "index.js"),
  path.join(__dirname, "..", "client-src", "index.js"),
];

/**
 * Whether one entry request is this package's client.
 * @param {string} request an entry request
 * @param {string} context the compilation's context, which relative requests are resolved against
 * @returns {boolean} true when the request is the client
 */
function isClientRequest(request, context) {
  // A query belongs to the client, not to which file it is.
  const [resource] = request.split("?");

  if (resource === CLIENT_PACKAGE_REQUEST) {
    return true;
  }

  // Resolved and compared as a path rather than by how it ends: a project's
  // own `./src/client/index.js` is a common application entry and has nothing
  // to do with this package.
  return CLIENT_FILES.includes(path.resolve(context, resource));
}

/**
 * Which of a compilation's entry points do not pull the client in.
 *
 * Per entry point, because they are separate pages: a build with `landing` and
 * `dashboard` where only `landing` has the client still needs one in
 * `dashboard`, or that page connects to nothing.
 *
 * Best effort by design: `entry` can be a function, and a request can reach the
 * client through an alias or a loader. Missing one of those costs a duplicate
 * entry, not a broken build, and `hot.inject: false` is the way out.
 * @param {Compiler} compiler compiler
 * @returns {string[] | null} the names that need one, or null when they all do
 */
function entriesMissingClient(compiler) {
  const { entry } = compiler.options;

  // Computed per build, so there is nothing to read here.
  if (typeof entry === "function") {
    return null;
  }

  const names = Object.keys(entry || {});
  const missing = names.filter((name) => {
    const imported = /** @type {EXPECTED_ANY} */ (entry)[name].import;
    const requests =
      typeof imported === "string"
        ? [imported]
        : Array.isArray(imported)
          ? imported
          : [];

    return !requests.some(
      (request) =>
        typeof request === "string" &&
        isClientRequest(request, compiler.context),
    );
  });

  // All of them, so one entry that every entry point gets — the same single
  // entry this added before it could tell them apart.
  return missing.length === names.length ? null : missing;
}

/**
 * Whether every entry point already pulls the client in.
 * @param {Compiler} compiler compiler
 * @returns {boolean} true when nothing needs adding
 */
function hasClientEntry(compiler) {
  const missing = entriesMissingClient(compiler);

  return missing !== null && missing.length === 0;
}

// Which `client` values the overlay reads as a filter rather than a flag. A
// function cannot travel as JSON, so it goes as its source and the client
// rebuilds it — the same encoding webpack-dev-server has always used.
const OVERLAY_FILTERS = ["errors", "warnings", "runtimeErrors"];

/**
 * Whether source can stand where the client puts it — after `var callback =`.
 * Compiled rather than run: nothing in it is executed here.
 * @param {string} source a function's source
 * @returns {boolean} true when it is an expression
 */
function isExpression(source) {
  try {
    // eslint-disable-next-line no-new-func
    const compiled = new Function(`var callback = ${source}`);

    return typeof compiled === "function";
  } catch {
    return false;
  }
}

/**
 * A filter as source the client can rebuild from.
 *
 * An arrow function and a `function` both stringify to something that can be
 * assigned; a method shorthand — `overlay: { errors(message) {} }` — does not,
 * and would have gone over as `errors(message) {}` for the client to choke on.
 * Making it a function expression is the whole of the difference.
 * @param {string} option which filter it is, for the error
 * @param {EXPECTED_ANY} filter the function given
 * @returns {string} source the client can assign
 */
function filterSource(option, filter) {
  const source = filter.toString();

  if (isExpression(source)) {
    return source;
  }

  if (isExpression(`function ${source}`)) {
    return `function ${source}`;
  }

  // Said here rather than left for the browser: this is a configuration
  // mistake, and the stack in a page would point at the client instead.
  throw new Error(
    `The 'hot.overlay.${option}' function could not be serialized for the browser. Write it as a function expression or an arrow function.`,
  );
}

/**
 * The two halves of the `transport` option: what this middleware serves the
 * stream with, and which built-in protocol the bundled client should speak to
 * it. The client half is `undefined` for a transport of your own, since there
 * is then nothing to point the bundled client at — `{ server, client }` is how
 * you say yours speaks one of the two.
 * @param {HotOptions["transport"]} transport the `hot.transport` option
 * @returns {{ server: ("sse" | "ws" | ClientStreamFactory), client: ("sse" | "ws" | undefined) }} the server half and the client half
 */
function resolveTransport(transport) {
  if (typeof transport === "function") {
    return { server: transport, client: undefined };
  }

  if (typeof transport === "object" && transport !== null) {
    return { server: transport.server, client: transport.client };
  }

  const name = transport || "sse";

  return { server: name, client: name };
}

// Which of `hot`'s options the browser runtime reads. The rest are the
// middleware's own, and the entry query carries only these.
const CLIENT_OPTIONS = [
  "url",
  "name",
  "overlay",
  "indicator",
  "hmr",
  "liveReload",
  "reloadOnFailedUpdate",
  "urlParamPrefix",
  "logging",
  "reconnect",
  "timeout",
  "autoConnect",
  "dynamicPublicPath",
];

/**
 * The browser options, as the client reads them from its resource query. Picked
 * out of `hot` rather than taken from a sub-object: which side of the wire
 * applies a setting is this module's problem, not the developer's.
 * @param {EXPECTED_ANY} hot the `hot` options
 * @returns {Record<string, string>} query parameters
 */
function clientQuery(hot) {
  /** @type {Record<string, string>} */
  const query = {};

  if (!hot) {
    return query;
  }

  for (const [key, value] of Object.entries(hot)) {
    if (typeof value === "undefined" || !CLIENT_OPTIONS.includes(key)) {
      continue;
    }

    if (key !== "overlay") {
      query[key] = String(value);
      continue;
    }

    if (typeof value !== "object" || value === null) {
      query.overlay = String(value);
      continue;
    }

    /** @type {Record<string, EXPECTED_ANY>} */
    const overlay = {};

    for (const [option, setting] of Object.entries(value)) {
      overlay[option] =
        OVERLAY_FILTERS.includes(option) && typeof setting === "function"
          ? encodeURIComponent(filterSource(option, setting))
          : setting;
    }

    query.overlay = JSON.stringify(overlay);
  }

  return query;
}

/**
 * Put the hot runtime into the compilation, so enabling `hot` is the whole of
 * what a developer has to do: no entry to add, no `HotModuleReplacementPlugin`
 * to remember, no configuration to change.
 *
 * The client is given the endpoint, the transport and the browser options
 * through its resource query, so it agrees with the server by construction
 * rather than by the developer keeping two settings in step.
 */

/**
 * @param {Compiler[]} compilers compilers to modify
 * @param {{ path: string, inject?: boolean, token?: string | false, hot: HotOptions }} options the path this middleware resolved, the token it minted, and the `hot` options as given
 * @param {Logger} logger logger
 */
function injectHotClient(compilers, options, logger) {
  if (options.inject === false) {
    return;
  }

  let warned = false;
  // A token only reaches the browser on the entry added below, so a required
  // one with nothing added would refuse every client.
  let injected = false;

  // What the developer set in node, which wins over everything below it: these
  // are the same options the query carries, so either spelling reaches the
  // runtime and the one written by hand is the one that counts.
  const client = clientQuery(options.hot);

  // Which protocol the client should speak, or nothing to point it at. A
  // transport of your own carries whatever protocol you wrote it to carry, and
  // the built-in client speaks two — so `transport: { server, client }` is how
  // you say yours is one of them.
  const { server, client: transport } = resolveTransport(options.hot.transport);

  // Halves that differ are for a client talking to something else, so it comes
  // with an endpoint of its own. Without one it is pointed straight back at
  // this middleware speaking the wrong protocol, which is a page that silently
  // never connects.
  if (
    typeof server === "string" &&
    transport &&
    transport !== server &&
    !options.hot.url
  ) {
    logger.warn(
      `'hot.transport' serves '${server}' while its 'client' half speaks '${transport}', so the client will not connect. Set them to the same thing, or give 'hot.url' the endpoint that does speak '${transport}'.`,
    );
  }

  for (const compiler of compilers) {
    if (!isWebTarget(compiler)) {
      continue;
    }

    const { webpack } = compiler;

    const missing = entriesMissingClient(compiler);

    if (missing === null || missing.length > 0) {
      if (transport === undefined) {
        if (!warned) {
          warned = true;
          logger.warn(
            "'hot.transport' is a function, so no client was added: the built-in one speaks Server-Sent Events and WebSocket, not a transport of your own. Write it as 'transport: { server, client }' if yours speaks one of them, or add an entry for the client that speaks it — 'HotModuleReplacementPlugin' is still applied for you, and 'hot.inject: false' silences this.",
          );
        }
      } else {
        // The endpoint and the transport the middleware resolved, and the
        // compilation's name so each bundle's client reports only its own
        // builds — without that a page shows an overlay for a build error in
        // code it does not contain. All three are defaults: whatever the
        // developer set is spread over them.
        const { name: compilation } = compiler.options;
        /** @type {Record<string, string>} */
        /** @type {Record<string, string>} */
        const query = { url: options.path, transport };

        // Not when `url` carries one already: that names another endpoint, and
        // its token is not this one's to overwrite.
        if (options.token && !/[?&]token=/.test(client.url || "")) {
          query.token = options.token;
        }

        if (compilation) {
          query.name = compilation;
        }

        const search = new URLSearchParams({ ...query, ...client }).toString();
        const entry = `${clientEntry()}?${search}`;

        injected = true;

        if (missing === null) {
          // No entry point has one, so a single entry every one of them gets.
          new webpack.EntryPlugin(compiler.context, entry, {
            name: undefined,
          }).apply(compiler);
        } else {
          // Some already have it. Adding a global entry would give those a
          // second copy, so the ones without it are named instead.
          for (const entryPoint of missing) {
            new webpack.EntryPlugin(compiler.context, entry, {
              name: entryPoint,
            }).apply(compiler);
          }
        }
      }
    }

    const hmrPluginExists = compiler.options.plugins.some(
      (plugin) =>
        plugin && plugin.constructor === webpack.HotModuleReplacementPlugin,
    );

    if (hmrPluginExists) {
      logger.warn(
        "'hot' applies HotModuleReplacementPlugin for you — it does not need to be in the webpack configuration as well.",
      );
    } else {
      new webpack.HotModuleReplacementPlugin().apply(compiler);
    }
  }

  // Every path above can decline to add an entry — every entry point already
  // pulls the client in, `hot.transport` is a function, the target is not the
  // web — and the endpoint still requires whatever token it was given. Said
  // here rather than left as a `403` with no explanation.
  //
  // Without the token itself in it. A minted one is different every run, so
  // printing it would invite exactly the wrong fix — pasting a value that is
  // already stale — and infrastructure warnings travel into CI output, where
  // a secret has no business being.
  if (options.token && !injected) {
    logger.warn(
      "'hot.token' requires a token on the endpoint, but no client entry was added to hand one over, so every client will be refused. Put 'token=<the token>' on the query of the client you added yourself, reading it from the middleware's 'token' property, or set a fixed 'hot.token' both sides know — or 'hot.token: false' to require none.",
    );
  }
}

module.exports = {
  CLIENT_OPTIONS,
  CORS_LOCAL_ORIGINS,
  HOT_DEFAULT_TOKEN,
  applyCors,
  clientQuery,
  createMimeTypes,
  createReadStreamOrReadFile,
  destroyStream,
  escapeHtml,
  etag,
  filterSource,
  finish,
  getHeadersSent,
  getOutgoing,
  getRequestHeader,
  getRequestMethod,
  getRequestURL,
  getResponseHeader,
  getResponseHeaders,
  getStatusCode,
  getValueContentRangeHeader,
  hasClientEntry,
  initState,
  injectHotClient,
  isSameOrigin,
  isTokenValid,
  isUpgradeAllowed,
  isWebTarget,
  matchOrigin,
  memorize,
  mimeScore,
  nodeReadableToWebStream,
  parseHttpDate,
  parseTokenList,
  pathMatch,
  pipe,
  removeResponseHeader,
  resolveCors,
  resolveToken,
  resolveTransport,
  send,
  setResponseHeader,
  setState,
  setStatusCode,
};
