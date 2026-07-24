import configureOverlay from "webpack-dev-middleware/client/overlay";

// This bundle simulates a second client (like webpack-dev-server's once it
// adopts this overlay): it carries its OWN copy of the overlay module and
// reports through its own `source` slot. The window singleton makes both
// copies render into one single overlay — and errors reported by either
// client take precedence over the other client's warnings.
const overlay = configureOverlay({});

const SOURCE = "widget";

/** @type {string[]} */
const errors = [];

const widget = document.getElementById("widget");

widget.innerHTML = `
  <p>Widget bundle: a separate client with its own copy of the overlay.</p>
  <button type="button" id="widget-error">Report widget error</button>
  <button type="button" id="widget-recovered">Widget recovered</button>
`;

widget.querySelector("#widget-error").addEventListener("click", () => {
  errors.push(
    `Widget error #${errors.length + 1}\n` +
      "Something broke inside the widget bundle.",
  );
  overlay.showProblems("errors", errors, SOURCE);
});

widget.querySelector("#widget-recovered").addEventListener("click", () => {
  errors.length = 0;
  // Drops only this client's problems; whatever the other client reported
  // stays on screen.
  overlay.clear(SOURCE);
});
