/** @typedef {import("node:http").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/** @typedef {import("../hot.js").Logger} Logger */
/** @typedef {import("../hot.js").Payload} Payload */
/** @typedef {import("../hot.js").EventStream} EventStream */
/** @typedef {import("../hot.js").StreamClient} StreamClient */
/** @typedef {import("../hot.js").CorsOption} CorsOption */

const {
  HOT_DEFAULT_CORS_SSE,
  applyCors,
  isTokenValid,
  resolveCors,
} = require("../utils.js");

/**
 * @param {number} heartbeat heartbeat interval in milliseconds
 * @param {Logger} logger logger
 * @param {CorsOption=} cors which origins may read the stream, the local ones by default
 * @param {(string | false)=} token the token the endpoint requires, or false for none
 * @returns {EventStream} event stream
 */
function createEventStream(heartbeat, logger, cors, token = false) {
  const corsGrant = resolveCors(cors ?? HOT_DEFAULT_CORS_SSE);
  let clientId = 0;
  /** @type {Map<number, ServerResponse>} */
  let clients = new Map();
  /** @type {((client: StreamClient, req: IncomingMessage) => void) | undefined} */
  let onConnectFn;

  /**
   * Run the callback for every client that can still be written to — a
   * response ended between two `close` events would throw on write.
   * @param {(client: ServerResponse) => void} fn each client callback
   */
  const everyClient = (fn) => {
    for (const client of clients.values()) {
      if (!client.writableEnded) {
        fn(client);
      }
    }
  };

  // Runs only while clients are connected: started with the first client,
  // stopped with the last one.
  /** @type {ReturnType<typeof setInterval> | null} */
  let interval = null;

  const startHeartbeat = () => {
    if (interval !== null) {
      return;
    }

    interval = setInterval(() => {
      everyClient((client) => {
        client.write("data: 💓\n\n");
      });
    }, heartbeat);

    // Don't block process exit on the heartbeat timer.
    if (typeof interval.unref === "function") {
      interval.unref();
    }
  };

  const stopHeartbeat = () => {
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  };

  return {
    close() {
      stopHeartbeat();
      everyClient((client) => {
        client.end();
      });
      clients = new Map();
    },
    hasClients() {
      return clients.size > 0;
    },
    onConnect(fn) {
      onConnectFn = fn;
    },
    handler(req, res) {
      // A response another middleware already started can no longer become an
      // SSE stream — end it instead of crashing on writeHead.
      if (res.headersSent) {
        if (!res.writableEnded) {
          res.end();
        }
        return;
      }

      // Before the stream, and without the CORS grant: a caller that does not
      // carry the token is told nothing about who may read this endpoint.
      if (!isTokenValid(token, req)) {
        logger.warn(
          `A request to "${req.url}" was refused: it carried no valid 'token'. The injected client is given one; a client of your own has to pass it, or set 'hot.token' to a value it can use.`,
        );
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }

      /** @type {Record<string, string>} */
      const headers = {
        "Content-Type": "text/event-stream;charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        // While behind nginx, the event stream should not be buffered:
        // http://nginx.org/docs/http/ngx_http_proxy_module.html#proxy_buffering
        "X-Accel-Buffering": "no",
      };

      applyCors(corsGrant, req, headers);

      const { httpVersion, socket } = req;
      const isHttp1 = !(Number.parseInt(httpVersion, 10) >= 2);

      if (isHttp1) {
        if (socket && typeof socket.setKeepAlive === "function") {
          socket.setKeepAlive(true);
        }
        headers.Connection = "keep-alive";
      }

      res.writeHead(200, headers);
      res.write("\n");

      const id = clientId++;
      clients.set(id, res);
      startHeartbeat();
      logger.log(`Client connected (${clients.size} active)`);

      const disconnect = () => {
        if (!clients.has(id)) {
          return;
        }

        if (!res.writableEnded) {
          res.end();
        }

        clients.delete(id);

        if (clients.size === 0) {
          stopHeartbeat();
        }

        logger.log(`Client disconnected (${clients.size} active)`);
      };

      req.on("close", disconnect);

      // A request that died before the handshake finished never emits `close`
      // again, so it would stay in `clients` forever.
      if (req.destroyed) {
        disconnect();

        return;
      }

      if (onConnectFn) {
        onConnectFn(res, req);
      }
    },
    publish(payload) {
      // With no clients connected there is nothing to serialize for.
      if (clients.size === 0) {
        return;
      }

      const frame = `data: ${JSON.stringify(payload)}\n\n`;

      everyClient((client) => {
        client.write(frame);
      });
    },
    publishTo(client, payload) {
      const res = /** @type {ServerResponse} */ (client);

      if (res.writableEnded) {
        return;
      }

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    },
  };
}

module.exports = createEventStream;
module.exports.createEventStream = createEventStream;
