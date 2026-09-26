/**
 * @returns {boolean} whether the page is on its way out
 */
export function isUnloading(): boolean;
/**
 * Reload the page. While it looks like the page is leaving, the reload is held
 * until that turns out to be wrong rather than performed or thrown away.
 * Isolated so tests can stub it — `window.location` is not configurable in
 * modern jsdom.
 */
export default function reloadPage(): void;
