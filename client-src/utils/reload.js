/**
 * Isolated so tests can stub it — `window.location` is not configurable in
 * modern jsdom.
 */
export default function reloadPage() {
  window.location.reload();
}
