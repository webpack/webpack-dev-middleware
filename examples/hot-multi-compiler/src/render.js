export function render() {
  const root = document.getElementById("root");

  // Edit this string and save — only the "app" bundle rebuilds; the "admin"
  // bundle publishes a `sync` event and stays untouched.
  root.textContent = "Hello from the app bundle!";
}
