/** @typedef {import("node:http").Server} HttpServer */
/** @typedef {import("node:http").IncomingMessage} IncomingMessage */
/** @typedef {import("node:stream").Duplex} Duplex */
/** @typedef {import("ws").WebSocket} WebSocket */
/** @typedef {typeof import("ws").WebSocketServer} WsServerConstructor */
/** @typedef {import("../hot.js").Logger} Logger */
/** @typedef {import("../hot.js").Payload} Payload */
/** @typedef {import("../hot.js").ClientStream} ClientStream */
/** @typedef {import("../hot.js").CorsOption} CorsOption */

const { isUpgradeAllowed, resolveCors } = require("../cors.js");

// How often a client is pinged to find out whether it is still there. A client
// that has not answered the previous ping is dropped rather than pinged again.
const WS_DEFAULT_HEARTBEAT = 10 * 1000;

/**
 * `ws` is only needed by `transport: "ws"`, so it is an optional dependency and
 * is required here rather than at the top of the module.
 * @returns {WsServerConstructor} the `ws` server constructor
 */
function requireWsServer() {
  try {
    return require("ws").WebSocketServer;
  } catch {
    throw new Error(
      "The 'hot.transport: \"ws\"' option needs the 'ws' package, which is an optional dependency of webpack-dev-middleware. Install it with `npm install ws`, or use the default 'hot.transport: \"sse\"'.",
    );
  }
}

/**
 * A client stream carried over WebSocket rather than Server-Sent Events. It
 * answers the same calls as `createEventStream`, so `createHot` does not know
 * which of them it is publishing to.
 * @param {object} options options
 * @param {string} options.path the path the endpoint is served at
 * @param {number} options.heartbeat heartbeat interval in milliseconds
 * @param {CorsOption=} options.cors which origins may connect, the local ones by default
 * @param {Logger} logger logger
 * @returns {ClientStream} client stream
 */
function createWebSocketStream({ path, heartbeat, cors }, logger) {
  const WebSocketServerImplementation = requireWsServer();
  const corsGrant = resolveCors(cors);
  /** @type {Set<WebSocket>} */
  const clients = new Set();
  /** @type {((client: WebSocket, req: IncomingMessage) => void) | undefined} */
  let onConnectFn;
  /** @type {HttpServer | undefined} */
  let attachedServer;
  /** @type {((req: IncomingMessage, socket: Duplex, head: Buffer) => void) | undefined} */
  let upgradeListener;

  const implementation = new WebSocketServerImplementation({
    noServer: true,
    path,
    // `clients` is tracked here so a client is dropped the moment it closes,
    // which is what `hasClients` reads.
    clientTracking: false,
  });

  implementation.on(
    "error",
    /** @param {Error} err error */ (err) => {
      logger.error(err.message);
    },
  );

  // A client that did not answer the previous ping is gone: a half-open socket
  // never emits `close`, so nothing else would ever remove it.
  /** @type {WeakSet<WebSocket>} */
  let awaitingPong = new WeakSet();
  /** @type {ReturnType<typeof setInterval> | null} */
  let interval = null;

  const startHeartbeat = () => {
    if (interval !== null) {
      return;
    }

    interval = setInterval(() => {
      for (const client of clients) {
        if (awaitingPong.has(client)) {
          client.terminate();
          continue;
        }

        awaitingPong.add(client);
        client.ping(() => {});
      }
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

  implementation.on(
    "connection",
    /**
     * @param {WebSocket} client client
     * @param {IncomingMessage} req the request that was upgraded
     */ (client, req) => {
      clients.add(client);
      startHeartbeat();
      logger.log(`Client connected (${clients.size} active)`);

      client.on("pong", () => {
        awaitingPong.delete(client);
      });

      client.on("close", () => {
        clients.delete(client);
        awaitingPong.delete(client);

        if (clients.size === 0) {
          stopHeartbeat();
        }

        logger.log(`Client disconnected (${clients.size} active)`);
      });

      client.on(
        "error",
        /** @param {Error} err error */ (err) => {
          logger.error(err.message);
        },
      );

      if (onConnectFn) {
        onConnectFn(client, req);
      }
    },
  );

  const detach = () => {
    if (attachedServer && upgradeListener) {
      attachedServer.removeListener("upgrade", upgradeListener);
    }

    attachedServer = undefined;
    upgradeListener = undefined;
  };

  /**
   * @param {IncomingMessage} req the request being upgraded
   * @param {Duplex} socket the request's socket
   * @param {Buffer} head the first packet of the upgraded stream
   * @returns {boolean} true when this endpoint answered the upgrade
   */
  const handleUpgrade = (req, socket, head) => {
    // Another WebSocket endpoint on the same server owns this path. Said
    // rather than assumed, so a caller holding the server can go on to its own
    // endpoints instead of leaving the socket hanging.
    if (!implementation.shouldHandle(req)) {
      return false;
    }

    // A handshake is not subject to CORS: a browser sends `Origin` and pays no
    // attention to what comes back, so the `cors` option can only be honoured
    // on this wire by refusing the upgrade — before it completes, rather than
    // closing the client afterwards, so nothing is ever published to it.
    if (!isUpgradeAllowed(corsGrant, req)) {
      logger.warn(
        `A client from the origin "${req.headers.origin}" was refused. Add it to the 'hot.cors' option to allow it.`,
      );

      // Answered rather than dropped: a socket destroyed without a response
      // reads to the client as the server going away, and reconnecting
      // forever. The upgrade is still this endpoint's, so `true`.
      socket.write(
        "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
      );
      socket.destroy();

      return true;
    }

    implementation.handleUpgrade(req, socket, head, (client) => {
      implementation.emit("connection", client, req);
    });

    return true;
  };

  return {
    attach(server) {
      // Attaching twice would upgrade every request twice over.
      if (attachedServer === server) {
        return;
      }

      if (attachedServer) {
        detach();
      }

      upgradeListener = (req, socket, head) => {
        handleUpgrade(req, socket, head);
      };

      attachedServer = server;
      server.on("upgrade", upgradeListener);
    },
    close() {
      stopHeartbeat();
      detach();

      for (const client of clients) {
        client.close();
      }

      clients.clear();
      awaitingPong = new WeakSet();
      implementation.close();
    },
    detach,
    handleUpgrade,
    // No `handler`: the handshake is an upgrade the HTTP server answers, so a
    // plain request reaching the middleware is a client which cannot speak this
    // transport, and answering that is `createHot`'s default for any transport
    // that does not serve requests itself.
    hasClients() {
      return clients.size > 0;
    },
    onConnect(fn) {
      onConnectFn = fn;
    },
    publish(payload) {
      // With no clients connected there is nothing to serialize for.
      if (clients.size === 0) {
        return;
      }

      const frame = JSON.stringify(payload);

      for (const client of clients) {
        if (client.readyState === client.OPEN) {
          client.send(frame);
        }
      }
    },
    publishTo(client, payload) {
      const socket = /** @type {WebSocket} */ (client);

      if (socket.readyState !== socket.OPEN) {
        return;
      }

      socket.send(JSON.stringify(payload));
    },
  };
}

module.exports = createWebSocketStream;
module.exports.WS_DEFAULT_HEARTBEAT = WS_DEFAULT_HEARTBEAT;
module.exports.createWebSocketStream = createWebSocketStream;
