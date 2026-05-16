/* global __webpack_hash__ */

if (!module.hot) {
  throw new Error("[HMR] Hot Module Replacement is disabled.");
}

const HMR_DOCS_URL = "https://webpack.js.org/concepts/hot-module-replacement/";

/** @type {string | undefined} */
let lastHash;
/** @type {Record<string, number>} */
const failureStatuses = { abort: 1, fail: 1 };

const applyOptions = {
  ignoreUnaccepted: true,
  ignoreDeclined: true,
  ignoreErrored: true,
  /**
   * @param {{ chain: string[] }} data data
   */
  onUnaccepted(data) {
    console.warn(
      `Ignored an update to unaccepted module ${data.chain.join(" -> ")}`,
    );
  },
  /**
   * @param {{ chain: string[] }} data data
   */
  onDeclined(data) {
    console.warn(
      `Ignored an update to declined module ${data.chain.join(" -> ")}`,
    );
  },
  /**
   * @param {{ error: Error, moduleId: string, type: string }} data data
   */
  onErrored(data) {
    console.error(data.error);
    console.warn(
      `Ignored an error while updating module ${data.moduleId} (${data.type})`,
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
 * @param {{ reload?: boolean, log?: boolean, warn?: boolean }} options client options
 */
module.exports = function (hash, moduleMap, options) {
  const { reload } = options;

  /**
   * @param {Error} err error
   */
  function handleError(err) {
    if (module.hot.status() in failureStatuses) {
      if (options.warn) {
        console.warn("[HMR] Cannot check for update (Full reload needed)");
        console.warn(`[HMR] ${err.stack || err.message}`);
      }
      performReload();
      return;
    }
    if (options.warn) {
      console.warn(`[HMR] Update check failed: ${err.stack || err.message}`);
    }
  }

  /**
   *
   */
  function performReload() {
    if (reload) {
      if (options.warn) console.warn("[HMR] Reloading page");
      window.location.reload();
    }
  }

  /**
   * @param {string[]} updatedModules ids of modules that were attempted to update
   * @param {string[] | undefined} renewedModules ids of modules that were successfully renewed
   */
  function logUpdates(updatedModules, renewedModules) {
    const unacceptedModules = updatedModules.filter(
      (moduleId) => !renewedModules || !renewedModules.includes(moduleId),
    );

    if (unacceptedModules.length > 0) {
      if (options.warn) {
        console.warn(
          "[HMR] The following modules couldn't be hot updated: " +
            "(Full reload needed)\n" +
            "This is usually because the modules which have changed " +
            "(and their parents) do not know how to hot reload themselves. " +
            `See ${HMR_DOCS_URL} for more details.`,
        );
        for (const moduleId of unacceptedModules) {
          console.warn(
            `[HMR]  - ${(moduleMap && moduleMap[moduleId]) || moduleId}`,
          );
        }
      }
      performReload();
      return;
    }

    if (options.log) {
      if (!renewedModules || renewedModules.length === 0) {
        console.log("[HMR] Nothing hot updated.");
      } else {
        console.log("[HMR] Updated modules:");
        for (const moduleId of renewedModules) {
          console.log(
            `[HMR]  - ${(moduleMap && moduleMap[moduleId]) || moduleId}`,
          );
        }
      }

      if (upToDate()) {
        console.log("[HMR] App is up to date.");
      }
    }
  }

  /**
   *
   */
  function check() {
    module.hot
      .check(false)
      .then((updatedModules) => {
        if (!updatedModules) {
          if (options.warn) {
            console.warn("[HMR] Cannot find update (Full reload needed)");
            console.warn("[HMR] (Probably because of restarting the server)");
          }
          performReload();
          return undefined;
        }

        return module.hot.apply(applyOptions).then((renewedModules) => {
          if (!upToDate()) check();
          logUpdates(updatedModules, renewedModules);
        });
      })
      .catch(handleError);
  }

  if (!upToDate(hash) && module.hot.status() === "idle") {
    if (options.log) console.log("[HMR] Checking for updates on the server...");
    check();
  }
};
