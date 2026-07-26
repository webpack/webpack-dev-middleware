import http from "node:http";

import createHotApp from "../helpers/hot-app";

jest.setTimeout(400000);

/**
 * Open a raw SSE connection and collect frames as they arrive.
 * @param {string} url SSE endpoint url
 * @returns {Promise<{ headers: EXPECTED_ANY, frames: string[], close: () => void }>} reader
 */
function openSseReader(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (res) => {
      /** @type {string[]} */
      const frames = [];
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            frames.push(line.slice("data: ".length));
          }
        }
      });
      resolve({
        headers: res.headers,
        frames,
        close: () => request.destroy(),
      });
    });
    request.on("error", reject);
  });
}

/**
 * @param {string[]} frames collected frames
 * @param {(frame: string) => boolean} predicate match
 * @param {number=} timeout give-up timeout
 * @returns {Promise<void>} resolved when a frame matches
 */
async function waitForFrame(frames, predicate, timeout = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (frames.some((frame) => predicate(frame))) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }

  throw new Error(`No frame matched.\nSeen:\n${frames.join("\n")}`);
}

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

describe("SSE protocol (raw)", () => {
  let app;
  /** @type {{ close: () => void }[]} */
  let readers = [];

  afterEach(async () => {
    for (const reader of readers) {
      reader.close();
    }
    readers = [];
    if (app) {
      const closing = app;
      app = undefined;
      await closing.close();
    }
  });

  it("keeps the HTTP/1 connection alive and heartbeats it", async () => {
    app = await createHotApp({
      code: "document.title = 'x';",
      hot: { heartbeat: 100 },
    });

    const reader = await openSseReader(`${app.url}__webpack_hmr`);
    readers.push(reader);

    expect(reader.headers.connection).toBe("keep-alive");
    expect(reader.headers["content-type"]).toBe(
      "text/event-stream;charset=utf-8",
    );

    // Real timers, real frames.
    await waitForFrame(reader.frames, (frame) => frame === "💓");
  });

  it("catch-up syncs only the newly connecting client", async () => {
    app = await createHotApp({ code: "document.title = 'x';" });

    const early = await openSseReader(`${app.url}__webpack_hmr`);
    readers.push(early);
    await waitForFrame(early.frames, (frame) => frame.includes('"sync"'));
    early.frames.length = 0;

    // A later client gets the catch-up sync; the connected one must not.
    const late = await openSseReader(`${app.url}__webpack_hmr`);
    readers.push(late);
    await waitForFrame(late.frames, (frame) => frame.includes('"sync"'));

    expect(early.frames.some((frame) => frame.includes('"sync"'))).toBe(false);
  });
});
