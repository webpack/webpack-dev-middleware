/**
 * @param {Record<string, string>} overrides overrides
 */
export function setOptionsAndConnect(overrides: Record<string, string>): void;
/**
 * Close the SSE connection for the current path and stop reconnecting. A
 * later `setOptionsAndConnect` call opens a fresh connection.
 */
export function disconnect(): void;
/**
 * @param {(obj: HMRPayload) => void} handler called for every incoming HMR message
 */
export function subscribeAll(handler: (obj: HMRPayload) => void): void;
/**
 * @param {(obj: HMRPayload) => void} handler called for messages whose `action` is not recognized
 */
export function subscribe(handler: (obj: HMRPayload) => void): void;
/**
 * @param {EXPECTED_ANY} customOverlay replacement for the default error overlay
 */
export function useCustomOverlay(customOverlay: EXPECTED_ANY): void;
export type MessageListener = (event: { data: string }) => void;
export type EXPECTED_ANY = any;
export type HMRPayload = {
  name?: string;
  errors: string[];
  warnings: string[];
  hash: string;
  time?: number;
  action?: string;
  file?: string;
  percent?: number;
  message?: string;
};
export type LogLevel = import("./utils/log.js").LogLevel;
/**
 * Superset of webpack-dev-server's `client.overlay` object; `styles`,
 * `ansiColors`, `openEditorEndpoint` and `paginate` are webpack-dev-middleware
 * extensions.
 */
export type OverlayOptions = {
  /**
   * show build errors in the overlay
   */
  errors?: (boolean | ((error: string) => boolean)) | undefined;
  /**
   * show build warnings in the overlay
   */
  warnings?: (boolean | ((warning: string) => boolean)) | undefined;
  /**
   * show uncaught runtime errors and unhandled rejections in the overlay
   */
  runtimeErrors?: (boolean | ((error: Error) => boolean)) | undefined;
  /**
   * Trusted Types policy name used for the overlay's HTML
   */
  trustedTypesPolicyName?: string | undefined;
  /**
   * overrides for the overlay card CSS
   */
  styles?: Record<string, string | number> | undefined;
  /**
   * overrides for ANSI → HTML color mapping
   */
  ansiColors?: Record<string, string | string[]> | undefined;
  /**
   * endpoint the overlay calls (GET `?fileName=file:line:column`) when a file reference is clicked; empty disables it
   */
  openEditorEndpoint?: string | undefined;
  /**
   * show one problem at a time with prev/next navigation
   */
  paginate?: boolean | undefined;
  /**
   * id of the overlay element, for a package embedding this overlay that has its own id to keep
   */
  id?: string | undefined;
};
/**
 * What a build does to the page. One option rather than three booleans,
 * because only four of their eight combinations differed: `liveReload` was
 * read only when Hot Module Replacement was off, and `reload` only when it
 * was on.
 *
 * - `"hmr"` — apply the update; reload if it cannot be applied
 * - `"hmr-only"` — apply the update; say so and stop if it cannot be applied
 * - `"reload"` — no Hot Module Replacement, reload on a build that changed something
 * - `"nothing"` — leave the page alone until it is reloaded by hand
 */
export type ApplyMode = "hmr" | "hmr-only" | "reload" | "nothing";
export type ConnectOptions = {
  /**
   * how many times to reconnect before giving up
   */
  retries?: number | undefined;
  /**
   * how long silence is tolerated before reconnecting, in milliseconds — Server-Sent Events only
   */
  timeout?: number | undefined;
};
export type ClientOptions = {
  /**
   * how the events are carried, matching the server's `hot.transport`
   */
  transport: "sse" | "ws";
  /**
   * endpoint path
   */
  path: string;
  /**
   * what a build does to the page
   */
  apply: ApplyMode;
  /**
   * whether to connect when the entry runs, and how the connection is held open
   */
  connect: boolean | ConnectOptions;
  /**
   * enable the in-page error overlay (same value shape as webpack-dev-server's `client.overlay`)
   */
  overlay: boolean | OverlayOptions;
  /**
   * prefix of the page-url parameters that override `apply` for one page
   */
  pageParamPrefix: string;
  /**
   * logger level
   */
  logging: LogLevel;
  /**
   * what to label messages with in the console
   */
  loggerName?: string | undefined;
  /**
   * limit updates to this compilation name
   */
  name: string;
  /**
   * the secret the endpoint requires, when it requires one, put on the connection url — empty when it requires none
   */
  token: string;
  /**
   * show an indicator while a rebuild is in progress — `true` and `"circular"` a small badge, `"linear"` a thin bar across the top of the viewport
   */
  progress: boolean | "circular" | "linear";
};
