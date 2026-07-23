import { render } from "./render.js";

render();

// Accept updates to `render.js` and re-run it so the DOM reflects the change
// without reloading the page.
if (module.hot) {
  module.hot.accept("./render.js", () => {
    render();
  });
}
