/**
 * Show the indicator (idempotent). With a percent the badge renders a
 * progress ring; without one it renders a pulsing dot.
 * @param {string=} text label text
 * @param {number=} percent compilation progress (0-100)
 * @param {string=} source who is building (e.g. a compilation name, or a
 * client sharing the badge) — the badge stays until every source finished
 */
export function show(
  text?: string | undefined,
  percent?: number | undefined,
  source?: string | undefined,
): void;
/**
 * Mark one source's build as finished, or remove the indicator entirely.
 * @param {string=} source when given, only that source is dropped and the
 * badge stays while any other source is still building; without it the badge
 * is removed unconditionally
 */
export function hide(source?: string | undefined): void;
/**
 * Choose which indicator is rendered. `"circular"` is the badge this package
 * has always shown; `"linear"` is the thin bar across the top of the viewport,
 * so `progress` can carry the same values as webpack-dev-server's.
 * @param {IndicatorType} type which indicator to render
 */
export function configure(type: IndicatorType): void;
export type EXPECTED_ANY = any;
export type IndicatorType = "circular" | "linear";
export type IndicatorState = {
  /**
   * badge host element
   */
  host: HTMLElement | null;
  /**
   * which indicator is rendered
   */
  type: IndicatorType;
  /**
   * label inside the badge
   */
  label: HTMLElement | null;
  /**
   * pulsing dot (indeterminate mode)
   */
  dot: HTMLElement | null;
  /**
   * progress ring (determinate mode)
   */
  ring: SVGSVGElement | null;
  /**
   * ring value circle
   */
  ringValue: SVGCircleElement | null;
  /**
   * filled part of the linear indicator
   */
  bar: HTMLElement | null;
  /**
   * the bar's sweep, when one is running
   */
  barAnimation: EXPECTED_ANY;
  /**
   * every running animation, so motion can be stopped on request
   */
  animations: EXPECTED_ANY[];
  /**
   * what watches for motion being declined mid-build
   */
  motionListener: EXPECTED_ANY;
  /**
   * the query that listener sits on, which is the only object it can be removed from
   */
  motionMediaQuery: EXPECTED_ANY;
  /**
   * sources with a build in progress — the badge hides only when every source finished
   */
  building: Record<string, true>;
};
