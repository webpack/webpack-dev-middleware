// Turning one of webpack's problems into something to read.
//
// The middleware formats a build's errors and warnings on the server, so its
// own payloads carry strings and its client never needs this. A server that
// sends webpack's error objects to the browser instead — which is what
// webpack-dev-server does — needs the same shape built there, and had to
// write it itself. Here it is once.
//
// Compiled to an ES5 baseline like the rest of the browser runtime, so
// nothing here is newer than that.

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */

/**
 * One of webpack's errors or warnings, as `stats.toJson()` reports it. Only
 * the fields that say something about where and what; anything else on a
 * `StatsError` is ignored.
 * @typedef {object} Problem
 * @property {string=} file the file the problem is in
 * @property {string=} moduleName the module's request, loaders and all
 * @property {string=} loc line and column within the module
 * @property {string=} message what went wrong
 * @property {(string[] | EXPECTED_ANY)=} stack frames webpack attached, when it did
 */

/**
 * Where a problem happened, as one line.
 *
 * A module processed by loaders reports its whole request as `moduleName`
 * (`babel-loader!./src/app.js`), which reads as noise where the file is what
 * matters — so the file comes first and the request follows it in brackets.
 * Empty when webpack said neither, rather than a line with nothing on it.
 * @param {string | Problem} item a problem, or a message on its own
 * @returns {string} the location, or an empty string
 */
export function problemLocation(item) {
  if (typeof item === "string") {
    return "";
  }

  const file = item.file || "";
  const request = item.moduleName || "";
  // `indexOf`, not `includes`: this file is compiled to an ES5 baseline.
  const loaded = request.indexOf("!") !== -1;
  // The module itself, with the loaders that built it stripped off.
  const moduleName = loaded ? request.replace(/^(\s|\S)*!/, "") : request;

  if (!moduleName && !file) {
    return "";
  }

  let where = moduleName || file;

  // The full request, when loaders made it something other than the module.
  if (loaded) {
    where += ` (${request})`;
  }

  // ... and the file, when webpack named one and it is not already what is
  // shown. It usually names none, and when it does it is often the module
  // itself — appending it either way read as `./a.js (./a.js)`.
  if (moduleName && file && file !== moduleName) {
    where += ` (${file})`;
  }

  return `${where}${item.loc ? ` ${item.loc}` : ""}`;
}

/**
 * What a problem says, with any stack webpack attached under it.
 * @param {string | Problem} item a problem, or a message on its own
 * @returns {string} the message
 */
export function problemBody(item) {
  if (typeof item === "string") {
    return item;
  }

  let body = item.message || "";

  if (Array.isArray(item.stack)) {
    // `for...of` needs an array iterator, which an ES5 target does not have.
    item.stack.forEach((frame) => {
      if (typeof frame === "string") {
        body += `\r\n${frame}`;
      }
    });
  }

  return body;
}

/**
 * A problem as one string, which is what the overlay renders: the location on
 * the first line, read as the heading, and the message under it.
 * @param {string | Problem} item a problem, or a message on its own
 * @returns {string} the problem
 */
export function problemLine(item) {
  const location = problemLocation(item);
  const body = problemBody(item);

  return location ? `${location}\n${body}` : body;
}

/**
 * A problem split for a console, where the level belongs in the heading rather
 * than being drawn around it.
 * @param {string} type `"warning"`, or anything else for an error
 * @param {string | Problem} item a problem, or a message on its own
 * @returns {{ header: string, body: string }} the problem, in two parts
 */
export function formatProblem(type, item) {
  const location = problemLocation(item);

  return {
    header: `${type === "warning" ? "WARNING" : "ERROR"}${
      location ? ` in ${location}` : ""
    }`,
    body: problemBody(item),
  };
}
