import type fs from 'fs';
import type express from 'express';
import type webpack from 'webpack';

export interface WebpackDevMiddlewareOptions {
  /**
   * A list of HTTP request methods accepted by the server.
   *
   * @default ['GET', 'HEAD']
   */
  methods?: string[];

  /**
   * Custom HTTP headers to set on each request.
   *
   * @example { 'X-Custom-Header': 'yes' }
   * @default undefined
   */
  headers?: Record<string, string>;

  /**
   * If `false` (but not `undefined`), the server will not respond to requests to the root URL.
   *
   * @default 'index.html'
   */
  index?: boolean | string;

  /**
   * Custom mime types or extension mappings.
   *
   * @example { phtml: 'text/html' }
   * @default undefined
   */
  mimeTypes?: Record<string, string>;

  /**
   * The public path that the middleware is bound to.
   *
   * @see https://webpack.js.org/guides/public-path
   * @default `output.publicPath`
   */
  publicPath?: string;

  /**
   * Instructs the module to enable or disable the server-side rendering mode.
   *
   * @default undefined
   */
  serverSideRender?: boolean;

  /**
   * If `true`, writes files to the configured location on disk
   * as specified in your `webpack` config file.
   *
   * If `function`, used to filter which files are written to disk.
   * @default false
   */
  writeToDisk?: boolean | ((filePath: string) => boolean);

  /**
   * @default `compiler.outputFileSystem`
   */
  outputFileSystem?: webpack.Compiler['outputFileSystem'];
}

export type MultiStats = Exclude<
  Parameters<Parameters<webpack.MultiCompiler['run']>[0]>[1],
  undefined
>;

export type MultiWatching = ReturnType<webpack.MultiCompiler['watch']>;

export interface WebpackDevMiddlewareContext {
  state: boolean;
  stats: webpack.Stats | MultiStats | null;
  callbacks:
    | Array<(stats: webpack.Stats) => void>
    | Array<(stats: MultiStats) => void>;
  options: WebpackDevMiddlewareOptions;
  compiler: webpack.Compiler | webpack.MultiCompiler;
  watching: ReturnType<webpack.Compiler['watch']> | MultiWatching | null;
  logger: ReturnType<webpack.Compiler['getInfrastructureLogger']>;
  outputFileSystem: ExtendedOutputFileSystem;
}

export interface WebpackDevMiddlewareSingleContext
  extends WebpackDevMiddlewareContext {
  stats: webpack.Stats | null;
  callbacks: Array<(stats: webpack.Stats) => void>;
  compiler: webpack.Compiler;
  watching: ReturnType<webpack.Compiler['watch']> | null;
}

export interface WebpackDevMiddlewareMultiContext
  extends WebpackDevMiddlewareContext {
  stats: MultiStats | null;
  callbacks: Array<(stats: MultiStats) => void>;
  compiler: webpack.MultiCompiler;
  watching: MultiWatching | null;
}

type OutputFileSystem = webpack.Compiler['outputFileSystem'];

// workaround until webpack generates more exact types
export interface ExtendedOutputFileSystem extends OutputFileSystem {
  readFileSync(filePath: string): Buffer;
  statSync(filePath: string): fs.Stats;
}

export interface WebpackDevMiddleware extends express.RequestHandler {
  context: WebpackDevMiddlewareContext;
  waitUntilValid(callback: (stats: webpack.Stats | MultiStats) => void): void;
  invalidate(callback: (stats: webpack.Stats | MultiStats) => void): void;
  close(callback: (err?: Error) => void): void;
}

export interface WebpackDevMiddlewareSingle extends WebpackDevMiddleware {
  context: WebpackDevMiddlewareSingleContext;
  waitUntilValid(callback: (stats: webpack.Stats) => void): void;
  invalidate(callback: (stats: webpack.Stats) => void): void;
}

export interface WebpackDevMiddlewareMulti extends WebpackDevMiddleware {
  context: WebpackDevMiddlewareMultiContext;
  waitUntilValid(callback: (stats: MultiStats) => void): void;
  invalidate(callback: (stats: MultiStats) => void): void;
}
