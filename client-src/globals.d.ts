/* eslint-disable */

declare module "ansi-html-community" {
  function ansiHtmlCommunity(str: string): string;
  namespace ansiHtmlCommunity {
    function setColors(colors: Record<string, string | string[]>): void;
  }
  export = ansiHtmlCommunity;
}

interface ClientReporter {
  cleanProblemsCache(name: string): void;
  clearRuntimeProblems(): void;
  problems(
    type: "errors" | "warnings",
    obj: { errors: string[]; warnings: string[]; name?: string },
  ): boolean;
  success(obj?: { name?: string }): void;
  useCustomOverlay(customOverlay: unknown): void;
}

interface EventSourceWrapper {
  addMessageListener(fn: (event: { data: string }) => void): void;
  close(): void;
}

interface CommunicationClient {
  onOpen(fn: (data?: string) => void): void;
  onClose(fn: (data?: string) => void): void;
  onMessage(fn: (data?: string) => void): void;
  close(): void;
}

interface CommunicationClientConstructor {
  new (url: string, options?: any): CommunicationClient;
}

declare const __webpack_dev_server_client__:
  | CommunicationClientConstructor
  | { default: CommunicationClientConstructor }
  | undefined;

interface OverlayTrustedTypesPolicy {
  createHTML(value: string): string;
}

interface Window {
  __wdmEventSourceWrapper?: Record<string, EventSourceWrapper>;
  __webpack_dev_middleware_hot_reporter__?: ClientReporter;
  trustedTypes?: {
    createPolicy(
      name: string,
      rules: { createHTML(value: string): string },
    ): OverlayTrustedTypesPolicy;
  };
}
