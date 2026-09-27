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
   * reconnection timeout in milliseconds
   */
  timeout: number;
  /**
   * enable the in-page error overlay (same value shape as webpack-dev-server's `client.overlay`)
   */
  overlay: boolean | OverlayOptions;
  /**
   * reload the page when HMR cannot apply the update
   */
  reload: boolean;
  /**
   * logger level
   */
  logging: LogLevel;
  /**
   * limit updates to this compilation name
   */
  name: string;
  /**
   * connect immediately when the entry runs
   */
  autoConnect: boolean;
  /**
   * how many times to reconnect before giving up, unset to use the transport's default
   */
  reconnect?: number | undefined;
  /**
   * show an indicator while a rebuild is in progress — `true` and `"circular"` a small badge, `"linear"` a thin bar across the top of the viewport
   */
  progress: boolean | "circular" | "linear";
};
