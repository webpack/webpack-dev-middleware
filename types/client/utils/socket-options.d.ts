/**
 * How `createSocket` should hold the connection open, for the transport in use.
 * @param {{ transport?: string, connect?: boolean | { retries?: number, timeout?: number } }} options the client options
 * @returns {{ retries: (number | undefined), retryDelay: (() => number) | undefined, clientOptions: { timeout: number } | undefined }} what `createSocket` takes
 */
export default function socketOptions(options: {
  transport?: string;
  connect?:
    | boolean
    | {
        retries?: number;
        timeout?: number;
      };
}): {
  retries: number | undefined;
  retryDelay: (() => number) | undefined;
  clientOptions:
    | {
        timeout: number;
      }
    | undefined;
};
