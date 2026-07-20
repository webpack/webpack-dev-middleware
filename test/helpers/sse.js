import http from "node:http";

/**
 * @typedef {object} SseEvent
 * @property {string=} action event action (building/built/sync/custom)
 * @property {string=} name compilation name
 * @property {string=} hash compilation hash
 * @property {number=} time build time in ms
 * @property {string[]=} errors errors
 * @property {string[]=} warnings warnings
 */

/**
 * Open the SSE endpoint just long enough to capture the response headers, then
 * force-close it (the stream never ends on its own).
 * @param {import("supertest").Test} pending pending supertest request
 * @returns {Promise<import("supertest").Response>} resolved response
 */
export async function readSseHandshake(pending) {
  return new Promise((resolve, reject) => {
    pending
      .buffer(false)
      .parse((res, cb) => {
        res.on("data", () => {});
        res.on("end", () => cb(null, ""));
        // SSE never closes on its own; force-close after we have headers.
        setTimeout(() => res.destroy(), 50);
      })
      .end((err, res) => {
        if (err && err.code !== "ECONNRESET") {
          reject(err);
          return;
        }
        resolve(res);
      });
  });
}

/**
 * Read the SSE stream directly over HTTP (supertest buffers streaming bodies
 * differently per framework), then close it and return the parsed payloads
 * (heartbeats and the initial handshake newline are skipped).
 * @param {import("node:http").Server & { info?: { port: number }, listener?: import("node:http").Server }} listeningServer the running server
 * @param {string} requestPath SSE endpoint path
 * @param {number} waitMs how long to collect events before closing
 * @returns {Promise<SseEvent[]>} parsed event payloads
 */
export async function readSseEvents(
  listeningServer,
  requestPath,
  waitMs = 250,
) {
  const httpServer = listeningServer.listener || listeningServer;
  const address =
    typeof httpServer.address === "function" ? httpServer.address() : null;
  const port =
    address && typeof address === "object" && address.port
      ? address.port
      : listeningServer.info && listeningServer.info.port
        ? listeningServer.info.port
        : 3000;

  return new Promise((resolve, reject) => {
    let raw = "";
    const pending = http.get(
      { host: "127.0.0.1", port, path: requestPath },
      (res) => {
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
      },
    );
    pending.on("error", (err) => {
      if (err.code !== "ECONNRESET") reject(err);
    });

    setTimeout(() => {
      pending.destroy();

      /** @type {SseEvent[]} */
      const events = [];
      for (const block of raw.split("\n\n")) {
        const line = block.split("\n").find((item) => item.startsWith("data:"));
        if (!line) continue;
        const payload = line.slice("data:".length).trim();
        if (!payload || payload === "💓") continue;
        try {
          events.push(JSON.parse(payload));
        } catch {
          // Ignore non-JSON frames.
        }
      }
      resolve(events);
    }, waitMs);
  });
}

/**
 * @param {{ waitUntilValid: (callback: () => void) => void }} devMiddleware middleware instance
 * @returns {Promise<void>} resolves once the first compilation is valid
 */
export async function waitUntilValid(devMiddleware) {
  return new Promise((resolve) => {
    devMiddleware.waitUntilValid(() => resolve());
  });
}
