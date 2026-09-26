// Set while the page is on its way out, so an update that lands mid-navigation
// does not reload the page the browser is already leaving. A `beforeunload` can
// be cancelled — by another listener, or by the user answering "stay" — so the
// flag is released again shortly after, and `pagehide`/`pageshow` settle the
// cases `beforeunload` gets wrong (a page kept in the back/forward cache runs
// the same script again when it comes back).
const UNLOAD_GRACE_PERIOD = 1000;

let unloading = false;
// A reload asked for while the page looked like it was leaving. Held rather
// than dropped: if the navigation was cancelled the page is staying and still
// wants the update, and nothing would ask again until the next rebuild.
let deferred = false;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let graceTimer;

/**
 * @returns {boolean} whether the page is on its way out
 */
export function isUnloading() {
  return unloading;
}

/**
 * Reload the page. While it looks like the page is leaving, the reload is held
 * until that turns out to be wrong rather than performed or thrown away.
 * Isolated so tests can stub it — `window.location` is not configurable in
 * modern jsdom.
 */
export default function reloadPage() {
  if (unloading) {
    deferred = true;

    return;
  }

  // In an iframe with no navigable url of its own — `srcdoc`, or a document
  // written into it — reloading would reload `about:blank` and lose the app, so
  // the nearest ancestor that has somewhere to go back to is reloaded instead.
  /** @type {Window} */
  let target = window;

  try {
    while (
      target.location.protocol === "about:" &&
      target.parent &&
      target.parent !== target
    ) {
      target = target.parent;
    }
  } catch {
    // A cross-origin ancestor: its location cannot be read, let alone
    // reloaded. Reloading this frame is the most that is permitted here.
    target = window;
  }

  target.location.reload();
}

if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("beforeunload", () => {
    unloading = true;

    clearTimeout(graceTimer);

    graceTimer = setTimeout(() => {
      unloading = false;

      if (deferred) {
        deferred = false;
        reloadPage();
      }
    }, UNLOAD_GRACE_PERIOD);
  });

  // The page really is going now, so stop reloading it for good — and drop
  // anything held, or it would fire into a document on its way out.
  window.addEventListener("pagehide", () => {
    clearTimeout(graceTimer);

    unloading = true;
    deferred = false;
  });

  // Restored from the back/forward cache: the same script keeps running, so a
  // flag left set by the navigation away would block every later update. The
  // page is showing its own state again, so a reload held from before that
  // navigation is stale and goes no further.
  window.addEventListener("pageshow", () => {
    clearTimeout(graceTimer);

    unloading = false;
    deferred = false;
  });
}
