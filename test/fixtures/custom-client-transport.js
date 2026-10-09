// A client transport of someone else's, in the shape the runtime asks for:
// constructed with the url, and reporting through `onOpen`, `onClose` and
// `onMessage`. It wraps a WebSocket and marks the page, so a test can tell it
// was the one used.
export default class CustomClientTransport {
  /**
   * @param {string} url url to connect to
   */
  constructor(url) {
    self.__customClientTransportUrl__ = url;
    this.client = new WebSocket(
      new URL(url, self.location.href).href.replace(/^http/, "ws"),
    );
  }

  /**
   * @param {(data?: string) => void} fn called once open
   */
  onOpen(fn) {
    this.client.addEventListener("open", () => fn());
  }

  /**
   * @param {(data?: string) => void} fn called once closed
   */
  onClose(fn) {
    this.client.addEventListener("close", () => fn());
  }

  /**
   * @param {(data?: string) => void} fn called with each message
   */
  onMessage(fn) {
    this.client.addEventListener("message", (event) => fn(event.data));
  }

  close() {
    this.client.close();
  }
}
