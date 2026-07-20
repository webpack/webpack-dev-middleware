import { renderAdmin } from "./admin-render.js";

renderAdmin();

// Accept updates to `admin-render.js` and re-run it so the DOM reflects the
// change without reloading the page.
if (module.hot) {
  module.hot.accept("./admin-render.js", () => {
    renderAdmin();
  });
}
