/**
 * @jest-environment jsdom
 */

import { hide, show } from "../client-src/indicator";

const INDICATOR_ID = "webpack-dev-middleware-building-indicator";
const INDICATOR_STATE_KEY = "__webpack_dev_middleware_hot_indicator_state__";

describe("indicator shared state across module copies", () => {
  afterEach(() => {
    hide();
    for (const element of document.querySelectorAll(`#${INDICATOR_ID}`)) {
      element.remove();
    }
    delete window[INDICATOR_STATE_KEY];
  });

  it("drives a single badge from a second bundled copy", () => {
    show("Rebuilding…");

    expect(document.querySelectorAll(`#${INDICATOR_ID}`)).toHaveLength(1);

    // A second copy of the module (e.g. the webpack-dev-server client
    // bundling its own) must adopt the same badge, not stack another.
    jest.resetModules();

    const secondCopy = require("../client-src/indicator");

    secondCopy.show("Rebuilding… 42%", 42);

    expect(document.querySelectorAll(`#${INDICATOR_ID}`)).toHaveLength(1);

    const host = document.getElementById(INDICATOR_ID);

    expect(host.shadowRoot.textContent).toContain("42%");

    // The state is shared, so the first copy's hide() removes the badge the
    // second copy updated.
    hide();
    expect(document.getElementById(INDICATOR_ID)).toBeNull();
  });

  it("keeps the badge while another source is still building", () => {
    show("Rebuilding app…", undefined, "app");
    show("Rebuilding admin…", undefined, "admin");

    hide("admin");
    expect(document.getElementById(INDICATOR_ID)).not.toBeNull();

    hide("app");
    expect(document.getElementById(INDICATOR_ID)).toBeNull();
  });

  it("ignores hiding a source that never reported and still removes unconditionally", () => {
    show("Rebuilding…", undefined, "app");

    hide("unknown");
    expect(document.getElementById(INDICATOR_ID)).not.toBeNull();

    // Without a source the badge is removed even with builds pending.
    hide();
    expect(document.getElementById(INDICATOR_ID)).toBeNull();
  });

  it("fills state fields missing from an older copy's shape", () => {
    // Simulate an older package version having created a leaner state.
    window[INDICATOR_STATE_KEY] = { host: null };

    jest.resetModules();

    const newerCopy = require("../client-src/indicator");

    expect(() => newerCopy.show("Rebuilding…")).not.toThrow();
    expect(document.querySelectorAll(`#${INDICATOR_ID}`)).toHaveLength(1);

    newerCopy.hide();
  });
});
