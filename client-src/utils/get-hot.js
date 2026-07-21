/**
 * Isolated so the HMR runtime can be stubbed in tests — `import.meta` cannot
 * be evaluated under jest's CommonJS transform.
 * @returns {webpack.Hot | undefined} the webpack HMR runtime API (`import.meta.webpackHot`)
 */
export default function getHot() {
  return import.meta.webpackHot;
}
