/**
 * EventStream implementation for Server-Sent Events (SSE)
 * Used to push Hot Module Replacement updates to connected clients
 */

/** @typedef {import("http").ServerResponse} ServerResponse */

/**
 * @typedef {object} EventStreamClient
 * @property {ServerResponse} response The HTTP response object
 * @property {NodeJS.Timeout | undefined} heartbeatTimer Timer for heartbeat messages
 */

/**
 * @typedef {object} EventStreamOptions
 * @property {number=} heartbeat Heartbeat interval in milliseconds (default: 10000)
 * @property {string=} path The path for the event stream endpoint (default: "/__webpack_hmr")
 */

class EventStream {
  /**
   * @param {EventStreamOptions=} options Configuration options
   */
  constructor(options = {}) {
    /** @type {EventStreamClient[]} */
    this.clients = [];

    /** @type {number} */
    this.heartbeatInterval = options.heartbeat || 10000;

    /** @type {string} */
    this.path = options.path || "/__webpack_hmr";

    /** @type {(() => void) | undefined} */
    this.closeCallback = undefined;
  }

  /**
   * Handle a new client connection
   * @param {import("http").IncomingMessage} req The request object
   * @param {ServerResponse} res The response object
   * @returns {void}
   */
  handler(req, res) {
    // Set headers for Server-Sent Events
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no", // Disable buffering in nginx
    });

    res.write("\n");

    /** @type {EventStreamClient} */
    const client = {
      response: res,
      heartbeatTimer: undefined,
    };

    this.clients.push(client);

    // Setup heartbeat to keep connection alive
    client.heartbeatTimer = setInterval(() => {
      if (!client.response.writableEnded && !client.response.finished) {
        try {
          client.response.write("data: \uD83D\uDC93\n\n");
        } catch {
          this.removeClient(client);
        }
      }
    }, this.heartbeatInterval).unref();

    // Handle client disconnect
    req.on("close", () => {
      this.removeClient(client);
    });

    // Send initial connection message
    this.sendToClient(client, { action: "connected" });
  }

  /**
   * Send a message to a specific client
   * @param {EventStreamClient} client The client to send to
   * @param {object} payload The data to send
   * @returns {boolean} Whether the message was sent successfully
   */
  sendToClient(client, payload) {
    try {
      if (client.response.writableEnded || client.response.finished) {
        return false;
      }

      // Format the data for Server-Sent Events
      const data = JSON.stringify(payload);
      client.response.write(`data: ${data}\n\n`);

      return true;
    } catch {
      // If write fails, remove the client
      this.removeClient(client);
      return false;
    }
  }

  /**
   * Broadcast a message to all connected clients
   * @param {object} payload The data to broadcast
   * @returns {void}
   */
  publish(payload) {
    // Send to all clients, removing any that fail
    this.clients = this.clients.filter((client) =>
      this.sendToClient(client, payload),
    );
  }

  /**
   * Remove a client from the list
   * @param {EventStreamClient} client The client to remove
   * @returns {void}
   */
  removeClient(client) {
    // Clear heartbeat timer
    if (client.heartbeatTimer) {
      clearInterval(client.heartbeatTimer);
      client.heartbeatTimer = undefined;
    }

    // Remove from clients array
    const index = this.clients.indexOf(client);
    if (index !== -1) {
      this.clients.splice(index, 1);
    }

    // Try to end the response if not already ended
    if (!client.response.writableEnded && !client.response.finished) {
      try {
        client.response.end();
      } catch {
        // Ignore errors when ending response
      }
    }
  }

  /**
   * Close all connections and clean up
   * @returns {void}
   */
  close() {
    // Remove all clients
    const clientsCopy = [...this.clients];

    for (const client of clientsCopy) {
      this.removeClient(client);
    }

    this.clients = [];

    // Call close callback if provided
    if (typeof this.closeCallback === "function") {
      this.closeCallback();
    }
  }

  /**
   * Check if a request is for the event stream endpoint
   * @param {string} url The request URL
   * @returns {boolean} Whether the URL matches the event stream path
   */
  isEventStreamRequest(url) {
    return url === this.path || url.startsWith(`${this.path}?`);
  }

  /**
   * Get the number of connected clients
   * @returns {number} Number of connected clients
   */
  getClientCount() {
    return this.clients.length;
  }

  /**
   * Set a callback to be called when the stream is closed
   * @param {() => void} callback The callback function
   * @returns {void}
   */
  onClose(callback) {
    this.closeCallback = callback;
  }
}

module.exports = EventStream;
