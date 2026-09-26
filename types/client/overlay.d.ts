/**
 * Remove one source's problems, or the whole overlay.
 * @param {string=} source when given, only that source's problems are
 * dropped and the overlay re-renders the remaining union; without it the
 * overlay is dismissed entirely (Escape, backdrop, close button)
 */
export function clear(source?: string | undefined): void;
/**
 * @param {"errors" | "warnings"} type problem type
 * @param {string[]} lines messages to render
 * @param {string=} source who reports them — each source (e.g. this client,
 * the webpack-dev-server client, the runtime error capture) keeps its own
 * slot and the overlay renders the union of every slot
 */
export function showProblems(
  type: "errors" | "warnings",
  lines: string[],
  source?: string | undefined,
): void;
/**
 * @param {{ ansiColors?: Record<string, string | string[]>, overlayStyles?: Record<string, string | number>, trustedTypesPolicyName?: string, catchRuntimeError?: boolean | ((error: Error) => boolean), openEditorEndpoint?: string, paginate?: boolean }} options options
 * @returns {{ showProblems: typeof showProblems, clear: typeof clear }} overlay api
 */
export default function configureOverlay(options: {
  ansiColors?: Record<string, string | string[]>;
  overlayStyles?: Record<string, string | number>;
  trustedTypesPolicyName?: string;
  catchRuntimeError?: boolean | ((error: Error) => boolean);
  openEditorEndpoint?: string;
  paginate?: boolean;
}): {
  showProblems: typeof showProblems;
  clear: typeof clear;
};
export type OverlayState = {
  /**
   * overlay iframe
   */
  frame: HTMLIFrameElement | null;
  /**
   * visible panel inside the iframe
   */
  card: HTMLElement | null;
  /**
   * whether the window listeners are attached
   */
  runtimeListenersAttached: boolean;
  /**
   * whether the host document's Escape listener is attached
   */
  hostKeydownAttached: boolean;
  /**
   * whether the next render is the first one of a newly opened overlay
   */
  focusOnRender: boolean;
  /**
   * page shown when paginating
   */
  pageIndex: number;
  /**
   * what the page had focused before the overlay opened
   */
  previousActiveElement: Element | null;
  /**
   * each reporting source's problems
   */
  problemsBySource: Record<
    string,
    {
      type: "errors" | "warnings";
      lines: string[];
    }
  >;
  /**
   * union of every source, as displayed
   */
  currentProblems: {
    type: "errors" | "warnings";
    lines: string[];
  } | null;
  /**
   * trusted types policy
   */
  trustedTypesPolicy:
    | {
        createHTML: (value: string) => EXPECTED_ANY;
      }
    | undefined;
  /**
   * whether (or which) runtime errors are shown — shared, so the copy that attached the window listeners honors every copy's configuration
   */
  catchRuntimeError: boolean | ((error: Error) => boolean);
};
export type EXPECTED_ANY = any;
