export function render() {
  const root = document.getElementById("root");

  // Edit this string (or break the syntax and save) — build problems from
  // this bundle are reported by the SSE hot client.
  root.innerHTML = `
    <p>App bundle: served with hot module replacement over SSE.</p>
    <p>Break <code>src/render.js</code> and save to see a build error.</p>
  `;
}
