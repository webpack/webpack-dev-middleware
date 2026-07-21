/* global __webpack_hash__ */

import getHot from "./utils/get-hot.js";
import { log } from "./utils/log.js";
import reloadPage from "./utils/reload.js";

const HMR_DOCS_URL = "https://webpack.js.org/concepts/hot-module-replacement/";

/** @type {string | undefined} */
let lastHash;
/** @type {Record<string, number>} */
const failureStatuses = { abort: 1, fail: 1 };
// Set per applyUpdate() call from the client's `reload` option.
let reloadOnErrored = false;
let loggedRuntimeMissing = false;

/** @type {webpack.ApplyOptions} */
const applyOptions = {
  ignoreUnaccepted: true,
  ignoreDeclined: true,
  ignoreErrored: true,
  onUnaccepted(event) {
    log.warn(
      `Ignored an update to unaccepted module ${event.chain.join(" -> ")}`,
    );
  },
  onDeclined(event) {
    log.warn(
      `Ignored an update to declined module ${event.chain.join(" -> ")}`,
    );
  },
  onErrored(event) {
    log.error(event.error);
    log.warn(
      `Ignored an error while updating module ${event.moduleId} (${event.type})`,
    );
    // An error thrown inside an accept handler leaves the app in an
    // undefined state — fall back to a full page reload.
    if (reloadOnErrored) {
      log.warn("Reloading page");
      reloadPage();
    }
  },
};

/**
 * @param {string=} hash latest webpack compilation hash
 * @returns {boolean} true when the current bundle matches the latest hash
 */
function upToDate(hash) {
  if (hash) lastHash = hash;
  return lastHash === __webpack_hash__;
}

/**
 * @param {string} hash latest hash from the SSE payload
 * @param {{ reload?: boolean }} options client options
 */
export default function applyUpdate(hash, options) {
  const maybeHot = getHot();

  if (!maybeHot) {
    // Logged (once) instead of thrown: this runs inside the SSE message
    // handler, whose catch would mislabel a throw as an invalid message.
    if (!loggedRuntimeMissing) {
      loggedRuntimeMissing = true;
      log.error(
        "[HMR] Hot Module Replacement is disabled. " +
          "Add HotModuleReplacementPlugin to the webpack configuration.",
      );
    }
    return;
  }

  const hot = maybeHot;
  const { reload } = options;

  reloadOnErrored = Boolean(reload);

  /**
   * Trigger a full page reload when HMR cannot apply the update.
   */
  function performReload() {
    if (reload) {
      log.warn("Reloading page");
      reloadPage();
    }
  }

  /**
   * @param {Error} err error
   */
  function handleError(err) {
    if (hot.status() in failureStatuses) {
      log.warn("Cannot check for update (Full reload needed)");
      log.warn(err.stack || err.message);
      performReload();
      return;
    }
    log.warn(`Update check failed: ${err.stack || err.message}`);
  }

  /**
   * @param {(string | number)[]} updatedModules ids of modules that were attempted to update
   * @param {(string | number)[] | null | undefined} renewedModules ids of modules that were successfully renewed
   */
  function logUpdates(updatedModules, renewedModules) {
    const unacceptedModules = updatedModules.filter(
      (moduleId) => !renewedModules || !renewedModules.includes(moduleId),
    );

    if (unacceptedModules.length > 0) {
      log.warn(
        "The following modules couldn't be hot updated: " +
          "(Full reload needed)\n" +
          "This is usually because the modules which have changed " +
          "(and their parents) do not know how to hot reload themselves. " +
          `See ${HMR_DOCS_URL} for more details.`,
      );
      for (const moduleId of unacceptedModules) {
        log.warn(` - ${moduleId}`);
      }
      performReload();
      return;
    }

    if (!renewedModules || renewedModules.length === 0) {
      log.info("Nothing hot updated.");
    } else {
      log.info(`Hot updated ${renewedModules.length} modules.`);
      // Detail as a collapsed group, visible from the "log" level up.
      log.groupCollapsed("Updated modules:");
      for (const moduleId of renewedModules) {
        log.log(` - ${moduleId}`);
      }
      log.groupEnd();
    }

    if (upToDate()) {
      log.info("App is up to date.");
    }
  }

  /**
   * Ask webpack for the next chunk of HMR updates and apply them.
   */
  function check() {
    hot
      .check(false)
      .then((updatedModules) => {
        if (!updatedModules) {
          log.warn("Cannot find update (Full reload needed)");
          log.warn("(Probably because of restarting the server)");
          performReload();
          return undefined;
        }

        return hot.apply(applyOptions).then((renewedModules) => {
          if (!upToDate()) check();
          logUpdates(updatedModules, renewedModules);
        });
      })
      .catch(handleError);
  }

  if (!upToDate(hash) && hot.status() === "idle") {
    log.info("Checking for updates on the server...");
    check();
  }
}
