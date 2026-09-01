export function renderAdmin() {
  const root = document.getElementById("admin-root");

  // Edit this string and save — only the "admin" bundle rebuilds; the "app"
  // bundle publishes a `sync` event and stays untouched.
  root.textContent = "Hello from the admin bundle!";
}
