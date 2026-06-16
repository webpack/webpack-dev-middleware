/* global __webpack_hash__ */

import { log } from "./utils/log.js";

const hot = import.meta.webpackHot;

if (!hot) {
  throw new Error("[HMR] Hot Module Replacement is disabled.");
}

const HMR_DOCS_URL = "https://webpack.js.org/concepts/hot-module-replacement/";

/** @type {string | undefined} */
let lastHash;
/** @type {Record<string, number>} */
const failureStatuses = { abort: 1, fail: 1 };

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
 * @param {Record<string, string> | undefined} moduleMap module id → name map
 * @param {{ reload?: boolean }} options client options
 */
export default function applyUpdate(hash, moduleMap, options) {
  const { reload } = options;

  /**
   * Trigger a full page reload when HMR cannot apply the update.
   */
  function performReload() {
    if (reload) {
      log.warn("Reloading page");
      window.location.reload();
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
        log.warn(` - ${(moduleMap && moduleMap[moduleId]) || moduleId}`);
      }
      performReload();
      return;
    }

    if (!renewedModules || renewedModules.length === 0) {
      log.info("Nothing hot updated.");
    } else {
      log.info("Updated modules:");
      for (const moduleId of renewedModules) {
        log.info(` - ${(moduleMap && moduleMap[moduleId]) || moduleId}`);
      }
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
