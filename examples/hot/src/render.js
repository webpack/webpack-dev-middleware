export function render() {
  const root = document.getElementById("root");

  // Edit this string (or anything below) and save — the page updates in place,
  // without a full reload, thanks to hot module replacement.
  root.innerHTML = `
    <p>Hello from webpack-dev-middleware hot module replacement!</p>
    <button type="button" id="throw-error">Throw runtime error</button>
    <button type="button" id="reject-promise">Unhandled rejection</button>
  `;

  // Each click adds one more uncaught error — the overlay accumulates them
  // until it is dismissed or the next successful rebuild clears it.
  root.querySelector("#throw-error").addEventListener("click", () => {
    throw new Error(`Demo runtime error #${Date.now() % 1000}`);
  });

  root.querySelector("#reject-promise").addEventListener("click", () => {
    Promise.reject(new Error("Demo unhandled rejection"));
  });
}
